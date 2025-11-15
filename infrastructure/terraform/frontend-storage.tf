# Frontend Static Hosting - Cloud Storage + CDN
# This file configures a global CDN-backed static site hosting

# Cloud Storage bucket for frontend static files
resource "google_storage_bucket" "frontend" {
  name          = "${var.project_id}-frontend"
  location      = "US"
  storage_class = "STANDARD"

  # Enable website configuration
  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"  # SPA routing - all 404s go to index.html
  }

  # CORS configuration for API calls
  cors {
    origin          = ["https://${var.domain}"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  # Versioning for rollback capability
  versioning {
    enabled = true
  }

  # Lifecycle rules to manage old versions
  lifecycle_rule {
    condition {
      num_newer_versions = 3
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  # Force destroy for dev/staging (remove for production)
  force_destroy = var.environment != "production"

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

# Make bucket contents publicly readable
resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.frontend.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# Reserve external IP address for load balancer
resource "google_compute_global_address" "frontend_ip" {
  name         = "frontend-lb-ip"
  address_type = "EXTERNAL"
  ip_version   = "IPV4"
}

# Backend bucket for Cloud CDN
resource "google_compute_backend_bucket" "frontend_cdn" {
  name        = "frontend-cdn-backend"
  bucket_name = google_storage_bucket.frontend.name
  enable_cdn  = true

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    client_ttl        = 3600    # 1 hour
    default_ttl       = 3600
    max_ttl           = 86400   # 24 hours
    negative_caching  = true
    serve_while_stale = 86400

    # Cache static assets aggressively
    cache_key_policy {
      include_host           = true
      include_protocol       = true
      include_query_string   = false
    }
  }

  # Custom response headers
  custom_response_headers = [
    "X-Cache-Hit: {cdn_cache_status}",
    "X-Cache-ID: {cdn_cache_id}",
  ]
}

# URL map - routes traffic to frontend or backend
resource "google_compute_url_map" "main" {
  name            = "main-url-map"
  default_service = google_compute_backend_bucket.frontend_cdn.id

  host_rule {
    hosts        = [var.domain]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_bucket.frontend_cdn.id

    # Route /api/* to backend Cloud Run
    path_rule {
      paths   = ["/api/*"]
      service = google_compute_backend_service.backend.id
    }

    # Route /health to backend
    path_rule {
      paths   = ["/health", "/health/*"]
      service = google_compute_backend_service.backend.id
    }

    # Everything else goes to frontend CDN
    path_rule {
      paths   = ["/*"]
      service = google_compute_backend_bucket.frontend_cdn.id
    }
  }
}

# HTTPS certificate (managed by Google)
resource "google_compute_managed_ssl_certificate" "main" {
  name = "main-ssl-cert"

  managed {
    domains = [var.domain]
  }

  lifecycle {
    create_before_destroy = true
  }
}

# HTTPS proxy
resource "google_compute_target_https_proxy" "main" {
  name             = "main-https-proxy"
  url_map          = google_compute_url_map.main.id
  ssl_certificates = [google_compute_managed_ssl_certificate.main.id]

  # Modern TLS policy
  ssl_policy = google_compute_ssl_policy.modern.id
}

# SSL policy - enforce TLS 1.2+
resource "google_compute_ssl_policy" "modern" {
  name            = "modern-ssl-policy"
  profile         = "MODERN"
  min_tls_version = "TLS_1_2"
}

# HTTPS forwarding rule
resource "google_compute_global_forwarding_rule" "https" {
  name                  = "frontend-https-rule"
  target                = google_compute_target_https_proxy.main.id
  port_range            = "443"
  ip_address            = google_compute_global_address.frontend_ip.address
  load_balancing_scheme = "EXTERNAL"
}

# HTTP to HTTPS redirect
resource "google_compute_url_map" "https_redirect" {
  name = "https-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "https_redirect" {
  name    = "https-redirect-proxy"
  url_map = google_compute_url_map.https_redirect.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "frontend-http-rule"
  target                = google_compute_target_http_proxy.https_redirect.id
  port_range            = "80"
  ip_address            = google_compute_global_address.frontend_ip.address
  load_balancing_scheme = "EXTERNAL"
}

# Outputs
output "frontend_bucket_name" {
  description = "Frontend storage bucket name"
  value       = google_storage_bucket.frontend.name
}

output "frontend_url" {
  description = "Frontend URL"
  value       = "https://${var.domain}"
}

output "load_balancer_ip" {
  description = "Load balancer IP address (point your domain DNS here)"
  value       = google_compute_global_address.frontend_ip.address
}

output "cdn_enabled" {
  description = "CDN status"
  value       = google_compute_backend_bucket.frontend_cdn.enable_cdn
}
