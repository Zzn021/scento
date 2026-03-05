resource "aws_s3_object" "ingestion_zip" {
  bucket = aws_s3_bucket.lambda_artifacts.bucket
  key    = "ingestion/ingestion.zip"

  source = "${path.module}/artifacts/ingestion.zip"
  etag   = filemd5("${path.module}/artifacts/ingestion.zip")
}