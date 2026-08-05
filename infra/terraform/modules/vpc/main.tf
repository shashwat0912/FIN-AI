locals {
  name_prefix             = "${var.project_name}-${var.environment}"
  availability_zones      = sort(tolist(var.availability_zones))
  primary_nat_az          = local.availability_zones[0]
  nat_availability_zones  = var.nat_mode == "none" ? toset([]) : var.nat_mode == "single" ? toset([local.primary_nat_az]) : var.availability_zones
  application_route_zones = var.nat_mode == "none" ? toset([]) : var.availability_zones
  application_default_routes = {
    for az in local.application_route_zones :
    "application/${az}" => {
      availability_zone = az
      route_table_id    = aws_route_table.private_application[az].id
      nat_gateway_id    = aws_nat_gateway.this[var.nat_mode == "single" ? local.primary_nat_az : az].id
    }
  }
  data_default_routes    = {}
  private_default_routes = merge(local.application_default_routes, local.data_default_routes)
  required_tags = {
    project      = var.project_name
    environment  = var.environment
    "managed-by" = "terraform"
    component    = "networking"
  }
  tags = merge(var.common_tags, local.required_tags)
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-igw"
  })
}

resource "aws_subnet" "public" {
  for_each = var.public_subnet_cidrs

  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = each.value
  map_public_ip_on_launch = true

  tags = merge(local.tags, {
    Name                     = "${local.name_prefix}-public-${each.key}"
    "kubernetes.io/role/elb" = "1"
  })
}

resource "aws_subnet" "private_application" {
  for_each = var.private_application_subnet_cidrs

  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = each.value
  map_public_ip_on_launch = false

  tags = merge(local.tags, {
    Name                              = "${local.name_prefix}-application-${each.key}"
    "kubernetes.io/role/internal-elb" = "1"
  })
}

resource "aws_subnet" "private_data" {
  for_each = var.private_data_subnet_cidrs

  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = each.value
  map_public_ip_on_launch = false

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-data-${each.key}"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-public-rt"
  })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  for_each = local.nat_availability_zones

  domain = "vpc"

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-nat-eip-${each.key}"
  })
}

resource "aws_nat_gateway" "this" {
  for_each = local.nat_availability_zones

  allocation_id = aws_eip.nat[each.key].id
  subnet_id     = aws_subnet.public[each.key].id

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-nat-${each.key}"
  })

  depends_on = [aws_internet_gateway.this]
}

resource "aws_route_table" "private_application" {
  for_each = var.availability_zones

  vpc_id = aws_vpc.this.id

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-application-${each.key}-rt"
  })
}

resource "aws_route" "private_application_egress" {
  for_each = local.private_default_routes

  route_table_id         = each.value.route_table_id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = each.value.nat_gateway_id
}

resource "aws_route_table_association" "private_application" {
  for_each = aws_subnet.private_application

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private_application[each.key].id
}

resource "aws_route_table" "private_data" {
  for_each = var.availability_zones

  vpc_id = aws_vpc.this.id

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-data-${each.key}-rt"
  })
}

resource "aws_route_table_association" "private_data" {
  for_each = aws_subnet.private_data

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private_data[each.key].id
}
