resource "aws_dynamodb_table" "registration_table" {
  name           = "ranked_crl_registration_table"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  
  attribute {
    name = "id"
    type = "S"
  }
  tags = {
    Name        = "ranked_crl_registration_table"
    Environment = "production"
  }
}