output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "IPv4 CIDR block of the VPC."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet IDs keyed by availability zone."
  value       = { for az, subnet in aws_subnet.public : az => subnet.id }
}

output "private_application_subnet_ids" {
  description = "Private application subnet IDs keyed by availability zone."
  value       = { for az, subnet in aws_subnet.private_application : az => subnet.id }
}

output "private_data_subnet_ids" {
  description = "Private data subnet IDs keyed by availability zone."
  value       = { for az, subnet in aws_subnet.private_data : az => subnet.id }
}

output "public_route_table_ids" {
  description = "Public route-table IDs."
  value       = [aws_route_table.public.id]
}

output "private_application_route_table_ids" {
  description = "Private application route-table IDs keyed by availability zone."
  value       = { for az, route_table in aws_route_table.private_application : az => route_table.id }
}

output "private_data_route_table_ids" {
  description = "Private data route-table IDs keyed by availability zone."
  value       = { for az, route_table in aws_route_table.private_data : az => route_table.id }
}

output "nat_gateway_ids" {
  description = "NAT Gateway IDs keyed by availability zone."
  value       = { for az, nat_gateway in aws_nat_gateway.this : az => nat_gateway.id }
}
