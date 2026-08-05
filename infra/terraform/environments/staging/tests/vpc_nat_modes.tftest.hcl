mock_provider "aws" {}

variables {
  project_name        = "finance-ai"
  environment         = "staging"
  vpc_cidr            = "10.10.0.0/16"
  availability_zones  = ["us-east-1a", "us-east-1b"]
  public_subnet_cidrs = { us-east-1a = "10.10.0.0/24", us-east-1b = "10.10.1.0/24" }
  private_application_subnet_cidrs = {
    us-east-1a = "10.10.10.0/24"
    us-east-1b = "10.10.11.0/24"
  }
  private_data_subnet_cidrs = {
    us-east-1a = "10.10.20.0/24"
    us-east-1b = "10.10.21.0/24"
  }
  common_tags = {
    project      = "must-not-override"
    environment  = "must-not-override"
    "managed-by" = "must-not-override"
    component    = "must-not-override"
    Name         = "must-not-override"
  }
}

run "no_nat" {
  command = plan

  module {
    source = "../../modules/vpc"
  }

  variables {
    nat_mode = "none"
  }

  assert {
    condition = (
      length(aws_nat_gateway.this) == 0 &&
      length(aws_eip.nat) == 0 &&
      length(aws_route.private_application_egress) == 0
    )
    error_message = "none mode must create no NAT Gateways, EIPs, or application default routes."
  }

  assert {
    condition     = length(local.data_default_routes) == 0
    error_message = "Private data subnets must have zero default routes."
  }
}

run "single_nat" {
  command = plan

  module {
    source = "../../modules/vpc"
  }

  variables {
    nat_mode = "single"
  }

  override_resource {
    target          = aws_nat_gateway.this["us-east-1a"]
    override_during = plan
    values = {
      id = "nat-primary"
    }
  }

  assert {
    condition = (
      length(aws_nat_gateway.this) == 1 &&
      length(aws_eip.nat) == 1 &&
      length(aws_route.private_application_egress) == 2
    )
    error_message = "single mode must create one NAT Gateway, one EIP, and two application default routes."
  }

  assert {
    condition     = alltrue([for route in aws_route.private_application_egress : route.nat_gateway_id == "nat-primary"])
    error_message = "Both application routes must target the shared NAT Gateway."
  }

  assert {
    condition     = length(local.data_default_routes) == 0
    error_message = "Private data subnets must have zero default routes."
  }

  assert {
    condition = (
      alltrue([for subnet in aws_subnet.public : subnet.map_public_ip_on_launch]) &&
      alltrue([for subnet in aws_subnet.private_application : !subnet.map_public_ip_on_launch]) &&
      alltrue([for subnet in aws_subnet.private_data : !subnet.map_public_ip_on_launch])
    )
    error_message = "Only public subnets may map public IPs on launch."
  }

  assert {
    condition = (
      alltrue([for subnet in aws_subnet.public : subnet.tags["kubernetes.io/role/elb"] == "1"]) &&
      alltrue([for subnet in aws_subnet.private_application : subnet.tags["kubernetes.io/role/internal-elb"] == "1"]) &&
      alltrue([for subnet in aws_subnet.private_data : !contains(keys(subnet.tags), "kubernetes.io/role/elb")]) &&
      alltrue([for subnet in aws_subnet.private_data : !contains(keys(subnet.tags), "kubernetes.io/role/internal-elb")])
    )
    error_message = "Kubernetes load-balancer discovery tags must remain scoped to public and application subnets."
  }

  assert {
    condition = (
      local.tags.project == var.project_name &&
      local.tags.environment == var.environment &&
      local.tags["managed-by"] == "terraform" &&
      local.tags.component == "networking" &&
      aws_vpc.this.tags.Name == "finance-ai-staging-vpc"
    )
    error_message = "common_tags must not override required ownership or Name tags."
  }
}

run "per_az_nat" {
  command = plan

  module {
    source = "../../modules/vpc"
  }

  variables {
    nat_mode = "per_az"
  }

  override_resource {
    target          = aws_nat_gateway.this["us-east-1a"]
    override_during = plan
    values = {
      id = "nat-a"
    }
  }

  override_resource {
    target          = aws_nat_gateway.this["us-east-1b"]
    override_during = plan
    values = {
      id = "nat-b"
    }
  }

  assert {
    condition = (
      length(aws_nat_gateway.this) == 2 &&
      length(aws_eip.nat) == 2 &&
      length(aws_route.private_application_egress) == 2
    )
    error_message = "per_az mode must create two NAT Gateways, two EIPs, and two application default routes."
  }

  assert {
    condition = alltrue([
      for route_key, route in local.application_default_routes :
      aws_route.private_application_egress[route_key].nat_gateway_id == aws_nat_gateway.this[route.availability_zone].id
    ])
    error_message = "Each application route must target the NAT Gateway with the same AZ key."
  }

  assert {
    condition     = length(local.data_default_routes) == 0
    error_message = "Private data subnets must have zero default routes."
  }
}

run "reject_duplicate_subnet_cidrs" {
  command = plan

  module {
    source = "../../modules/vpc"
  }

  variables {
    nat_mode = "none"
    private_data_subnet_cidrs = {
      us-east-1a = "10.10.0.0/24"
      us-east-1b = "10.10.21.0/24"
    }
  }

  expect_failures = [var.private_data_subnet_cidrs]
}

run "reject_mismatched_az_keys" {
  command = plan

  module {
    source = "../../modules/vpc"
  }

  variables {
    nat_mode = "none"
    public_subnet_cidrs = {
      us-east-1a = "10.10.0.0/24"
    }
  }

  expect_failures = [var.public_subnet_cidrs]
}

run "reject_unsupported_nat_mode" {
  command = plan

  module {
    source = "../../modules/vpc"
  }

  variables {
    nat_mode = "managed"
  }

  expect_failures = [var.nat_mode]
}

run "reject_unsupported_environment" {
  command = plan

  module {
    source = "../../modules/vpc"
  }

  variables {
    environment = "development"
    nat_mode    = "none"
  }

  expect_failures = [var.environment]
}
