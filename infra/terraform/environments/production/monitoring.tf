resource "aws_sns_topic" "demo_alerts" {
  name = "${local.name_prefix}-alerts"
  tags = merge(var.additional_tags, local.default_tags)
}

# Subscribe and confirm an operator email separately; no addresses in state.
output "alerts_topic_arn" {
  value = aws_sns_topic.demo_alerts.arn
}

resource "aws_cloudwatch_log_group" "containers" {
  for_each          = toset(["application", "host", "dataplane", "performance"])
  name              = "/aws/containerinsights/${module.eks.cluster_name}/${each.key}"
  retention_in_days = 30
  tags              = merge(var.additional_tags, local.default_tags)
}

locals {
  demo_alarms = {
    rds_cpu = {
      namespace  = "AWS/RDS", metric = "CPUUtilization", threshold = 80
      comparison = "GreaterThanThreshold"
      dimensions = { DBInstanceIdentifier = module.rds_postgres.db_instance_identifier }
    }
    rds_free_storage = {
      namespace  = "AWS/RDS", metric = "FreeStorageSpace", threshold = 10737418240
      comparison = "LessThanThreshold"
      dimensions = { DBInstanceIdentifier = module.rds_postgres.db_instance_identifier }
    }
    valkey_cpu = {
      namespace  = "AWS/ElastiCache", metric = "EngineCPUUtilization", threshold = 80
      comparison = "GreaterThanThreshold"
      dimensions = { CacheClusterId = "${module.elasticache_valkey.replication_group_id}-001", CacheNodeId = "0001" }
    }
    valkey_memory = {
      namespace  = "AWS/ElastiCache", metric = "DatabaseMemoryUsagePercentage", threshold = 80
      comparison = "GreaterThanThreshold"
      dimensions = { CacheClusterId = "${module.elasticache_valkey.replication_group_id}-001", CacheNodeId = "0001" }
    }
    failed_nodes = {
      namespace  = "ContainerInsights", metric = "cluster_failed_node_count", threshold = 0
      comparison = "GreaterThanThreshold"
      dimensions = { ClusterName = module.eks.cluster_name }
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "demo" {
  for_each            = local.demo_alarms
  alarm_name          = "${local.name_prefix}-${each.key}"
  alarm_description   = "FIN-AI demo: investigate ${each.key}; see docs/PUBLIC_DEMO.md"
  namespace           = each.value.namespace
  metric_name         = each.value.metric
  dimensions          = each.value.dimensions
  comparison_operator = each.value.comparison
  threshold           = each.value.threshold
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  treat_missing_data  = "missing"
  alarm_actions       = [aws_sns_topic.demo_alerts.arn]
  ok_actions          = [aws_sns_topic.demo_alerts.arn]
  tags                = merge(var.additional_tags, local.default_tags)
}
