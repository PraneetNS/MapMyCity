import os
import cloudinary

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "demo_cloud")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "1234567890")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "dummy_secret")

if not os.getenv("CLOUDINARY_CLOUD_NAME"):
    print("[Cloudinary] CLOUDINARY_CLOUD_NAME not set. Operating with fallback demo Cloudinary config.")

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
    secure=True
)
