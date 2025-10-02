# This file defines all DynamoDB resources

# Table to store user data
resource "aws_dynamodb_table" "registration_table" {
  name         = "ranked_crl_registration_table"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "playerTag"
    type = "S"
  }

  global_secondary_index {
    name            = "playerTag-index"
    hash_key        = "playerTag"
    projection_type = "ALL"
  }

  tags = {
    Name        = "ranked_crl_registration_table"
    Environment = "production"
  }
}
