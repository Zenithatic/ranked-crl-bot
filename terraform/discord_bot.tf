# This file defines all necessary resources for the bot

# CloudWatch Log Group for Discord bot logs only
resource "aws_cloudwatch_log_group" "discord_bot_logs" {
  name              = "/aws/ec2/discord-bot"
  retention_in_days = 7

  tags = {
    Name        = "discord_bot_logs"
    Environment = "production"
  }
}

# ECR Repo
resource "aws_ecr_repository" "discord_bot_repo" {
  name                 = "ranked-crl-discord-bot-repo"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name        = "ranked_crl_discord_bot_repo"
    Environment = "production"
  }
}

# Lifecycle policy to manage old images and reduce costs
resource "aws_ecr_lifecycle_policy" "discord_bot_lifecycle" {
  repository = aws_ecr_repository.discord_bot_repo.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Delete untagged images older than 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# EC2 Instance for Discord Bot (arm)
resource "aws_instance" "discord_bot_instance" {
  ami                         = "ami-08982f1c5bf93d976" # Amazon Linux AMI
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.public_subnet.id
  vpc_security_group_ids      = [aws_security_group.discord_bot_sg.id]
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.discord_bot_profile.name

  user_data = base64encode(file("${path.module}/user_data.sh"))

  tags = {
    Name        = "ranked_crl_discord_bot_instance"
    Environment = "production"
  }
}

# IAM Role for EC2 to access ECR, DynamoDB, and S3
resource "aws_iam_role" "discord_bot_ec2_role" {
  name = "ranked_crl_discord_bot_ec2_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# Attach policies to the role
resource "aws_iam_role_policy_attachment" "ecr_access" {
  role       = aws_iam_role.discord_bot_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "dynamodb_access" {
  role       = aws_iam_role.discord_bot_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_role_policy_attachment" "s3_access" {
  role       = aws_iam_role.discord_bot_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_role_policy_attachment" "ssm_access" {
  role       = aws_iam_role.discord_bot_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cloudwatch_logs_access" {
  role       = aws_iam_role.discord_bot_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
}

# Instance Profile to link IAM Role to EC2
resource "aws_iam_instance_profile" "discord_bot_profile" {
  name = "discord_bot_profile"
  role = aws_iam_role.discord_bot_ec2_role.name
}
