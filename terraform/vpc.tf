# Main VPC
resource "aws_vpc" "ranked_crl_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name        = "ranked_crl_vpc"
    Environment = "production"
  }
}

# Internet Gateway for public internet access
resource "aws_internet_gateway" "ranked_crl_igw" {
  vpc_id = aws_vpc.ranked_crl_vpc.id

  tags = {
    Name        = "ranked_crl_igw"
    Environment = "production"
  }
}

# Public Subnet (For Discord Bot)
resource "aws_subnet" "public_subnet" {
  vpc_id                  = aws_vpc.ranked_crl_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true

  tags = {
    Name        = "ranked_crl_public_subnet"
    Environment = "production"
    Type        = "public"
  }
}

# Private Subnet (for internal resources) - currently unused
resource "aws_subnet" "private_subnet" {
  vpc_id            = aws_vpc.ranked_crl_vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "us-east-1b"

  tags = {
    Name        = "ranked_crl_private_subnet"
    Environment = "production"
    Type        = "private"
  }
}

# Route Table for Public Subnet
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.ranked_crl_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.ranked_crl_igw.id
  }

  tags = {
    Name        = "ranked_crl_public_rt"
    Environment = "production"
  }
}

# Route Table Association for Public Subnet
resource "aws_route_table_association" "public_rta" {
  subnet_id      = aws_subnet.public_subnet.id
  route_table_id = aws_route_table.public_rt.id
}

# NAT Gateway for Private Subnet (implement later)
#resource "aws_eip" "nat_eip" {
#domain = "vpc"

#depends_on = [aws_internet_gateway.ranked_crl_igw]

#tags = {
#Name        = "ranked_crl_nat_eip"
#Environment = "production"
#}
#}

#resource "aws_nat_gateway" "ranked_crl_nat" {
#allocation_id = aws_eip.nat_eip.id
#subnet_id     = aws_subnet.public_subnet.id

#tags = {
#Name        = "ranked_crl_nat_gateway"
#Environment = "production"
#}

#depends_on = [aws_internet_gateway.ranked_crl_igw]
#}

# Route Table for Private Subnet (implement later)
#resource "aws_route_table" "private_rt" {
#vpc_id = aws_vpc.ranked_crl_vpc.id

#route {
#cidr_block     = "0.0.0.0/0"
#nat_gateway_id = aws_nat_gateway.ranked_crl_nat.id
#}

#tags = {
#Name        = "ranked_crl_private_rt"
#Environment = "production"
#}
#}

# Route Table Association for Private Subnet (implement later)
#resource "aws_route_table_association" "private_rta" {
#subnet_id      = aws_subnet.private_subnet.id
#route_table_id = aws_route_table.private_rt.id
#}

# Security Group for Discord Bot EC2 Instance
resource "aws_security_group" "discord_bot_sg" {
  name_prefix = "discord-bot-"
  vpc_id      = aws_vpc.ranked_crl_vpc.id

  # Outbound rules (bot needs to connect to Discord API)
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound for Discord API"
  }

  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP outbound"
  }

  # DNS
  egress {
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "DNS"
  }

  tags = {
    Name        = "discord_bot_sg"
    Environment = "production"
  }
}

# VPC Endpoints for AWS Services  
resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id       = aws_vpc.ranked_crl_vpc.id
  service_name = "com.amazonaws.us-east-1.dynamodb"

  route_table_ids = [aws_route_table.public_rt.id]

  tags = {
    Name        = "ranked_crl_dynamodb_endpoint"
    Environment = "production"
  }
}
