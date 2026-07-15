import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import exifr from "https://esm.sh/exifr@2.2.0";
import jpeg from "https://esm.sh/jpeg-js@0.4.4";

// 1. Initialize Supabase Client
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// 2. Average Perceptual Hash (aHash) implementation
function computeAverageHash(rgbaPixels: Uint8Array, width: number, height: number): string {
  const blockWidth = width / 8;
  const blockHeight = height / 8;
  const grays = new Float32Array(64);

  for (let blockY = 0; blockY < 8; blockY++) {
    for (let blockX = 0; blockX < 8; blockX++) {
      let sum = 0;
      let count = 0;
      const startY = Math.floor(blockY * blockHeight);
      const endY = Math.min(height, Math.floor((blockY + 1) * blockHeight));
      const startX = Math.floor(blockX * blockWidth);
      const endX = Math.min(width, Math.floor((blockX + 1) * blockWidth));

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          const r = rgbaPixels[idx];
          const g = rgbaPixels[idx + 1];
          const b = rgbaPixels[idx + 2];
          // Grayscale formula:
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          sum += gray;
          count++;
        }
      }
      grays[blockY * 8 + blockX] = count > 0 ? sum / count : 0;
    }
  }

  // Compute average of the 8x8 block values
  let totalSum = 0;
  for (let i = 0; i < 64; i++) {
    totalSum += grays[i];
  }
  const average = totalSum / 64;

  // Construct binary hash string
  let hashStr = "";
  for (let i = 0; i < 64; i++) {
    hashStr += grays[i] >= average ? "1" : "0";
  }

  return hashStr;
}

// 3. Hamming distance calculator
function getHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 64;
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance;
}

// 4. EXIF date parser helper
function parseExifDate(exifDateStr: string): Date | null {
  if (!exifDateStr) return null;
  // Standard EXIF format: "YYYY:MM:DD HH:MM:SS"
  const match = exifDateStr.match(/^(\d{4}):(\d{2}):(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [_, y, m, d, hh, mm, ss] = match;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  }
  const d = new Date(exifDateStr);
  return isNaN(d.getTime()) ? null : d;
}

// 5. Edge Function Handler
serve(async (req) => {
  try {
    // Basic Auth Check or POST Check
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Only POST requests allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const { record, type } = payload;

    // Validate payload shape and only process INSERT triggers
    if (type !== "INSERT" || !record) {
      return new Response(JSON.stringify({ message: "No action required. Trigger payload is not an INSERT." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const flags: string[] = [];
    let pHashValue: string | null = null;

    console.log(`Processing Tier 0 validations for submission ID: ${record.id}`);

    // --- CHECK 1: Fetch Image & Compute pHash & EXIF checks ---
    if (record.photo_url) {
      try {
        const response = await fetch(record.photo_url);
        if (!response.ok) {
          throw new Error(`Failed to fetch image from photo_url: ${record.photo_url}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        // A. EXIF Timestamp check
        try {
          const exif = await exifr.parse(arrayBuffer).catch(() => null);
          if (exif) {
            const rawExifDate = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate;
            let exifDate: Date | null = null;
            if (rawExifDate instanceof Date) {
              exifDate = rawExifDate;
            } else if (typeof rawExifDate === "string") {
              exifDate = parseExifDate(rawExifDate);
            }

            if (exifDate && record.captured_at) {
              const capturedDate = new Date(record.captured_at);
              const diffMs = Math.abs(capturedDate.getTime() - exifDate.getTime());
              const tenMinutesMs = 10 * 60 * 1000;

              if (diffMs > tenMinutesMs) {
                console.warn(`[FLAG] EXIF timestamp mismatch detected for submission ${record.id}`);
                flags.push("EXIF_TIMESTAMP_MISMATCH");
              }
            }
          }
        } catch (exifErr) {
          console.error("Error parsing EXIF data:", exifErr);
        }

        // B. Perceptual hash generation
        try {
          const rawData = new Uint8Array(arrayBuffer);
          const decoded = jpeg.decode(rawData, { useTops: true });
          pHashValue = computeAverageHash(decoded.data, decoded.width, decoded.height);
          console.log(`Computed pHash for ${record.id}: ${pHashValue}`);
        } catch (hashErr) {
          console.error("Error decoding JPEG or computing hash:", hashErr);
        }
      } catch (fetchErr) {
        console.error("Error fetching or processing image file:", fetchErr);
      }
    }

    // --- CHECK 2: Perceptual Hash (pHash) Dedup (Spatial + Image Similarity) ---
    if (pHashValue && record.latitude && record.longitude) {
      try {
        const { data: nearby, error: rpcError } = await supabase.rpc("get_nearby_submissions", {
          target_lon: record.longitude,
          target_lat: record.latitude,
          max_distance_meters: 50.0,
          exclude_id: record.id,
        });

        if (rpcError) {
          throw rpcError;
        }

        if (nearby && nearby.length > 0) {
          for (const other of nearby) {
            if (other.p_hash) {
              const distance = getHammingDistance(pHashValue, other.p_hash);
              // Threshold: Hamming distance <= 10 flags as a potential duplicate
              if (distance <= 10) {
                console.warn(`[FLAG] Potential duplicate detected: submission ${record.id} is similar to ${other.id} (Hamming Distance: ${distance})`);
                flags.push("DUPLICATE_LOCATION_HASH");
                break; // One matching duplicate is sufficient to flag
              }
            }
          }
        }
      } catch (dedupErr) {
        console.error("Error running pHash dedup query:", dedupErr);
      }
    }

    // --- CHECK 3: Device Velocity Check (Submission rate check) ---
    if (record.device_id) {
      try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count, error: velocityError } = await supabase
          .from("submissions")
          .select("*", { count: "exact", head: true })
          .eq("device_id", record.device_id)
          .gt("submitted_at", oneHourAgo)
          .neq("id", record.id);

        if (velocityError) {
          throw velocityError;
        }

        if (count && count >= 5) {
          console.warn(`[FLAG] Velocity limit exceeded: device ${record.device_id} submitted ${count} reports in the last hour.`);
          flags.push("VELOCITY_LIMIT_EXCEEDED");
        }
      } catch (velocityErr) {
        console.error("Error running device velocity check:", velocityErr);
      }
    }

    // --- UPDATE DATABASE ---
    const updatePayload: Record<string, any> = { flags };
    if (pHashValue) {
      updatePayload.p_hash = pHashValue;
    }

    console.log(`Updating database for submission ${record.id} with flags:`, flags);
    const { error: dbUpdateError } = await supabase
      .from("submissions")
      .update(updatePayload)
      .eq("id", record.id);

    if (dbUpdateError) {
      throw dbUpdateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        p_hash: pHashValue,
        flags: flags,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("Critical error in edge function:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
