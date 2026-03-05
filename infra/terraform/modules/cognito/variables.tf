variable "project" { type = string }
variable "env"     { type = string }
variable "tags"    { type = map(string) }

variable "callback_urls" { type = list(string) }
variable "logout_urls"   { type = list(string) }

variable "domain_prefix" {
  type    = string
  default = null
}