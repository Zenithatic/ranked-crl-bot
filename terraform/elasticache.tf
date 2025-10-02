# This file defines all ElastiCache resources

# Security Group for ElastiCache Valkey
resource "aws_security_group" "elasticache_sg" {
  name_prefix = "elasticache-valkey-"
  vpc_id      = aws_vpc.ranked_crl_vpc.id

  # Allow inbound Valkey traffic from Discord bot
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.discord_bot_sg.id]
    description     = "Valkey access from Discord bot"
  }

  # No outbound rules needed for ElastiCache
  tags = {
    Name        = "elasticache_valkey_sg"
    Environment = "production"
  }
}

# Elasticache for player queue + game data
resource "aws_elasticache_subnet_group" "elasticache_subnet_group" {
  name       = "ranked-crl-elasticache-valkey-subnet-group"
  subnet_ids = [aws_subnet.public_subnet.id]

  tags = {
    Name        = "ranked_crl_elasticache_valkey_subnet_group"
    Environment = "production"
  }
}

# Valkey Replication Group for scalability
resource "aws_elasticache_replication_group" "valkey_replication_group" {
  replication_group_id       = "ranked-crl-valkey-rg"
  description                = "Valkey replication group for Discord bot - scalable"
  engine                     = "valkey"
  port                       = 6379
  parameter_group_name       = "default.valkey8"
  node_type                  = "cache.t3.micro"
  num_cache_clusters         = 1     # Start with 1 primary, can scale to add replicas
  automatic_failover_enabled = false # Disabled for single node, enable when scaling
  multi_az_enabled           = false # Enable when adding replicas
  subnet_group_name          = aws_elasticache_subnet_group.elasticache_subnet_group.name
  security_group_ids         = [aws_security_group.elasticache_sg.id]

  maintenance_window       = "sun:05:00-sun:09:00"
  snapshot_retention_limit = 5
  snapshot_window          = "03:00-05:00"

  tags = {
    Name        = "ranked_crl_valkey_replication_group"
    Environment = "production"
  }
}


