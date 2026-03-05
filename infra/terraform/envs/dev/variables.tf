variable "aws_region" {
  type    = string
  default = "ap-southeast-2"
}

variable "project" {
  type    = string
  default = "scento"
}

variable "env" {
  type    = string
  default = "dev"
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "name_suffix" {
  type        = string
  description = "Make S3 bucket names globally unique (e.g. harry021)"
}

# For later frontend integration. Keep localhost for now.
variable "cognito_callback_urls" {
  type    = list(string)
  default = ["http://localhost:3000"]
}

variable "cognito_logout_urls" {
  type    = list(string)
  default = ["http://localhost:3000"]
}

# variable "lambda_runtime" {
#   type    = string
#   default = "nodejs20.x"
# }

# variable "lambda_artifacts_dir" {
#   type        = string
#   description = "Directory that contains lambda zip artifacts"
#   default     = "../../../artifacts"
# }

# variable "cors_allowed_origins" {
#   type    = list(string)
#   default = ["http://localhost:3000"]
# }

# variable "cognito_callback_urls" {
#   type    = list(string)
#   default = ["http://localhost:3000"]
# }

# variable "cognito_logout_urls" {
#   type    = list(string)
#   default = ["http://localhost:3000"]
# }