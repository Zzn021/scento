locals { name = "${var.project}-${var.env}" }

resource "aws_cognito_user_pool" "this" {
  name = "${local.name}-userpool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  tags = var.tags
}

resource "aws_cognito_user_pool_client" "this" {
  name         = "${local.name}-web-client"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls
}

resource "aws_cognito_user_pool_domain" "this" {
  count        = var.domain_prefix == null ? 0 : 1
  domain       = var.domain_prefix
  user_pool_id = aws_cognito_user_pool.this.id
}