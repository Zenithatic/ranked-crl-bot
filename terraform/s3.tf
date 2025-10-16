# This file defines necessary S3 buckets for the bot

resource "aws_s3_bucket" "match_channel_log_bucket" {
  bucket = "rankedcrl-match-channel-logs"

  tags = {
    Name        = "ranked_crl_match_channel_log_bucket"
    Environment = "production"
  }
}

resource "aws_s3_bucket_public_access_block" "block" {
  bucket = aws_s3_bucket.match_channel_log_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "sse" {
  bucket = aws_s3_bucket.match_channel_log_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "lifecycle" {
  bucket = aws_s3_bucket.match_channel_log_bucket.id

  rule {
    id     = "ExpireOldLogs"
    status = "Enabled"

    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_policy" "match_channel_log_bucket_policy" {
  bucket = aws_s3_bucket.match_channel_log_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowDiscordBotEC2RoleAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.discord_bot_ec2_role.arn
        }
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.match_channel_log_bucket.arn,
          "${aws_s3_bucket.match_channel_log_bucket.arn}/*"
        ]
      }
    ]
  })
}

