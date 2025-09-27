# Configure Terraform settings and required providers
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "rankedcrl-tf-state-bucket"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "rankedcrl-tf-lock-table"
    encrypt        = true
  }
}

# Configure the AWS Provider
provider "aws" {
  region = "us-east-1"
}