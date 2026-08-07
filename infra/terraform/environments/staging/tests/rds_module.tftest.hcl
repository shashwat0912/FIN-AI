mock_provider "aws" {}

variables {
  project_name                  = "finance-ai"
  environment                   = "staging"
  vpc_id                        = "vpc-staging"
  private_data_subnet_ids       = { us-east-1a = "subnet-data-a", us-east-1b = "subnet-data-b" }
  application_security_group_id = "sg-eks-applications"
  engine_version                = "15"
  instance_class                = "db.t4g.micro"
  database_name                 = "financeai"
  master_username               = "financeai_admin"
  allocated_storage             = 20
  max_allocated_storage         = 100
  multi_az                      = false
  backup_retention_period       = 7
  deletion_protection           = false
  skip_final_snapshot           = true
  final_snapshot_identifier     = null
  cloudwatch_log_retention_days = 30
  common_tags = {
    project      = "must-not-override"
    environment  = "must-not-override"
    "managed-by" = "must-not-override"
    component    = "must-not-override"
    Name         = "must-not-override"
  }
}

run "private_encrypted_postgres" {
  command = plan

  module {
    source = "../../modules/rds-postgres"
  }

  override_resource {
    target          = aws_security_group.this
    override_during = plan
    values = {
      id = "sg-database"
    }
  }

  override_resource {
    target          = aws_db_instance.this
    override_during = plan
    values = {
      master_user_secret = [{
        kms_key_id    = "alias/aws/secretsmanager"
        secret_arn    = "mock-secret-arn"
        secret_status = "active"
      }]
    }
  }

  assert {
    condition = (
      toset(aws_db_subnet_group.this.subnet_ids) == toset(values(var.private_data_subnet_ids)) &&
      !contains(aws_db_subnet_group.this.subnet_ids, "subnet-public-a") &&
      !contains(aws_db_subnet_group.this.subnet_ids, "subnet-application-a")
    )
    error_message = "The DB subnet group must contain only the two supplied private-data subnets."
  }

  assert {
    condition = (
      !aws_db_instance.this.publicly_accessible &&
      aws_db_instance.this.port == 5432 &&
      toset(aws_db_instance.this.vpc_security_group_ids) == toset([aws_security_group.this.id]) &&
      length(aws_security_group.this.ingress) == 0 &&
      length(aws_security_group.this.egress) == 0
    )
    error_message = "RDS must be private on port 5432 and use an ingress-only database security group."
  }

  assert {
    condition = (
      aws_vpc_security_group_ingress_rule.postgresql.ip_protocol == "tcp" &&
      aws_vpc_security_group_ingress_rule.postgresql.from_port == 5432 &&
      aws_vpc_security_group_ingress_rule.postgresql.to_port == 5432 &&
      aws_vpc_security_group_ingress_rule.postgresql.security_group_id == aws_security_group.this.id &&
      aws_vpc_security_group_ingress_rule.postgresql.referenced_security_group_id == var.application_security_group_id &&
      aws_vpc_security_group_ingress_rule.postgresql.cidr_ipv4 == null &&
      aws_vpc_security_group_ingress_rule.postgresql.cidr_ipv6 == null
    )
    error_message = "Database ingress must be TCP/5432 from only the EKS/application security group, never a CIDR."
  }

  assert {
    condition = (
      aws_db_instance.this.engine == "postgres" &&
      aws_db_instance.this.engine_version == var.engine_version &&
      aws_db_instance.this.engine_lifecycle_support == "open-source-rds-extended-support-disabled" &&
      aws_db_instance.this.auto_minor_version_upgrade &&
      !aws_db_instance.this.allow_major_version_upgrade &&
      !aws_db_instance.this.iam_database_authentication_enabled
    )
    error_message = "The instance must remain PostgreSQL with safe minor/major and IAM-auth settings."
  }

  assert {
    condition = (
      aws_db_instance.this.storage_type == "gp3" &&
      aws_db_instance.this.storage_encrypted &&
      aws_db_instance.this.allocated_storage == var.allocated_storage &&
      aws_db_instance.this.max_allocated_storage == var.max_allocated_storage
    )
    error_message = "RDS must use encrypted gp3 storage and the configured autoscaling bounds."
  }

  assert {
    condition = (
      aws_db_instance.this.manage_master_user_password &&
      aws_db_instance.this.username == var.master_username &&
      output.master_user_secret_arn == "mock-secret-arn"
    )
    error_message = "RDS must manage the master password and expose only its secret ARN."
  }

  assert {
    condition = (
      aws_db_instance.this.backup_retention_period == 7 &&
      !aws_db_instance.this.deletion_protection &&
      aws_db_instance.this.skip_final_snapshot &&
      aws_db_instance.this.final_snapshot_identifier == null &&
      !aws_db_instance.this.multi_az
    )
    error_message = "The staging example must remain single-AZ with seven-day backups and disposable deletion settings."
  }

  assert {
    condition = (
      aws_db_instance.this.database_insights_mode == "standard" &&
      aws_db_instance.this.performance_insights_enabled &&
      aws_db_instance.this.performance_insights_retention_period == 7 &&
      toset(aws_db_instance.this.enabled_cloudwatch_logs_exports) == toset(["postgresql", "upgrade"]) &&
      toset([for log_group in aws_cloudwatch_log_group.this : log_group.name]) == toset([
        "/aws/rds/instance/finance-ai-staging-postgres/postgresql",
        "/aws/rds/instance/finance-ai-staging-postgres/upgrade",
      ]) &&
      alltrue([for log_group in aws_cloudwatch_log_group.this :
        log_group.retention_in_days == 30 && log_group.skip_destroy == null
      ])
    )
    error_message = "Database Insights Standard and retained PostgreSQL/upgrade logs must be configured."
  }

  assert {
    condition = alltrue(concat(
      [for tags in [aws_db_instance.this.tags, aws_db_subnet_group.this.tags, aws_security_group.this.tags] :
        tags.project == var.project_name &&
        tags.environment == var.environment &&
        tags["managed-by"] == "terraform" &&
        tags.component == "database" &&
        tags.Name == "finance-ai-staging-postgres"
      ],
      [for log_type, log_group in aws_cloudwatch_log_group.this :
        log_group.tags.project == var.project_name &&
        log_group.tags.environment == var.environment &&
        log_group.tags["managed-by"] == "terraform" &&
        log_group.tags.component == "database" &&
        log_group.tags.Name == "finance-ai-staging-postgres-${log_type}"
      ],
      [
        aws_vpc_security_group_ingress_rule.postgresql.tags.project == var.project_name &&
        aws_vpc_security_group_ingress_rule.postgresql.tags.environment == var.environment &&
        aws_vpc_security_group_ingress_rule.postgresql.tags["managed-by"] == "terraform" &&
        aws_vpc_security_group_ingress_rule.postgresql.tags.component == "database" &&
        aws_vpc_security_group_ingress_rule.postgresql.tags.Name == "finance-ai-staging-postgres-from-eks"
      ],
    ))
    error_message = "common_tags must not override database ownership or Name tags."
  }
}

run "accept_disabled_storage_autoscaling" {
  command = plan

  module {
    source = "../../modules/rds-postgres"
  }

  variables {
    max_allocated_storage = 0
  }

  assert {
    condition     = aws_db_instance.this.max_allocated_storage == 0
    error_message = "Zero must disable storage autoscaling."
  }
}

run "reject_autoscaling_below_ten_percent" {
  command = plan

  module {
    source = "../../modules/rds-postgres"
  }

  variables {
    allocated_storage     = 20
    max_allocated_storage = 21
  }

  expect_failures = [var.max_allocated_storage]
}

run "accept_autoscaling_at_ten_percent" {
  command = plan

  module {
    source = "../../modules/rds-postgres"
  }

  variables {
    allocated_storage     = 20
    max_allocated_storage = 22
  }

  assert {
    condition     = aws_db_instance.this.max_allocated_storage == 22
    error_message = "A 10% storage autoscaling margin must be accepted."
  }
}

run "reject_nonpositive_storage" {
  command = plan

  module {
    source = "../../modules/rds-postgres"
  }

  variables {
    allocated_storage = 0
  }

  expect_failures = [var.allocated_storage]
}

run "reject_missing_final_snapshot" {
  command = plan

  module {
    source = "../../modules/rds-postgres"
  }

  variables {
    skip_final_snapshot = false
  }

  expect_failures = [var.final_snapshot_identifier]
}

run "reject_protected_snapshot_discard" {
  command = plan

  module {
    source = "../../modules/rds-postgres"
  }

  variables {
    deletion_protection = true
  }

  expect_failures = [var.skip_final_snapshot]
}

run "reject_protected_zero_backup_retention" {
  command = plan

  module {
    source = "../../modules/rds-postgres"
  }

  variables {
    deletion_protection       = true
    skip_final_snapshot       = false
    final_snapshot_identifier = "finance-ai-staging-final"
    backup_retention_period   = 0
  }

  expect_failures = [var.backup_retention_period]
}
