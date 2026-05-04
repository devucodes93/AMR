const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";
const TOTAL_PER_TYPE = 50;

const BANGALORE_LOCATIONS = [
  {
    district: "Bengaluru Urban",
    pincode: "560001",
    latitude: 12.9716,
    longitude: 77.5946,
    locationLabel: "MG Road, Bengaluru Urban, 560001",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560002",
    latitude: 12.9629,
    longitude: 77.5804,
    locationLabel: "K R Market, Bengaluru Urban, 560002",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560003",
    latitude: 12.9987,
    longitude: 77.5713,
    locationLabel: "Malleshwaram, Bengaluru Urban, 560003",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560004",
    latitude: 12.9442,
    longitude: 77.5707,
    locationLabel: "Basavanagudi, Bengaluru Urban, 560004",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560034",
    latitude: 12.9352,
    longitude: 77.6245,
    locationLabel: "Koramangala, Bengaluru Urban, 560034",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560037",
    latitude: 12.9698,
    longitude: 77.7499,
    locationLabel: "Marathahalli, Bengaluru Urban, 560037",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560008",
    latitude: 12.9719,
    longitude: 77.6408,
    locationLabel: "Ulsoor, Bengaluru Urban, 560008",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560016",
    latitude: 13.0168,
    longitude: 77.6776,
    locationLabel: "KR Puram, Bengaluru Urban, 560016",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560024",
    latitude: 13.033,
    longitude: 77.595,
    locationLabel: "Hebbal, Bengaluru Urban, 560024",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560038",
    latitude: 12.9601,
    longitude: 77.6387,
    locationLabel: "Indiranagar, Bengaluru Urban, 560038",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560048",
    latitude: 12.9956,
    longitude: 77.6965,
    locationLabel: "Mahadevapura, Bengaluru Urban, 560048",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560056",
    latitude: 13.0502,
    longitude: 77.5045,
    locationLabel: "Kengeri Satellite Town, Bengaluru Urban, 560056",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560064",
    latitude: 13.1369954,
    longitude: 77.5667732,
    locationLabel: "Avalahalli, Bengaluru Urban, 560064",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560066",
    latitude: 12.9937,
    longitude: 77.7431,
    locationLabel: "Whitefield, Bengaluru Urban, 560066",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560070",
    latitude: 12.925,
    longitude: 77.5468,
    locationLabel: "Banashankari, Bengaluru Urban, 560070",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560078",
    latitude: 12.9081,
    longitude: 77.5852,
    locationLabel: "J P Nagar, Bengaluru Urban, 560078",
  },
  {
    district: "Bengaluru Rural",
    pincode: "562157",
    latitude: 13.2278,
    longitude: 77.7278,
    locationLabel: "Devanahalli, Bengaluru Rural, 562157",
  },
  {
    district: "Bengaluru Rural",
    pincode: "562110",
    latitude: 13.2923,
    longitude: 77.8052,
    locationLabel: "Chikkaballapura Road Belt, Bengaluru Rural, 562110",
  },
  {
    district: "Bengaluru Urban",
    pincode: "560100",
    latitude: 12.8452,
    longitude: 77.6602,
    locationLabel: "Electronic City, Bengaluru Urban, 560100",
  },
];

const HOTSPOT_PINCODES = new Set(["560064", "560066", "560100", "560048"]);

const DISEASES = [
  "Urinary Tract Infection",
  "Lower Respiratory Infection",
  "Skin and Soft Tissue Infection",
  "Typhoid Fever",
  "Acute Gastroenteritis",
  "Post-op Wound Infection",
  "Community Acquired Pneumonia",
];

const ANTIBIOTICS = [
  "Amoxicillin 500mg",
  "Azithromycin 500mg",
  "Cefixime 200mg",
  "Ciprofloxacin 500mg",
  "Doxycycline 100mg",
  "Levofloxacin 500mg",
  "Piperacillin/Tazobactam",
  "Meropenem 1g",
];

const PRODUCTS = [
  "Amoxicillin Capsules",
  "Azithromycin Tablets",
  "Cefixime Tablets",
  "Ciprofloxacin Tablets",
  "Doxycycline Capsules",
  "Levofloxacin Tablets",
  "Meropenem Injection",
  "Piperacillin-Tazobactam Vial",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickLocation() {
  const hotspotPool = BANGALORE_LOCATIONS.filter((loc) =>
    HOTSPOT_PINCODES.has(loc.pincode),
  );
  const random = Math.random();
  if (random < 0.65 && hotspotPool.length > 0) {
    return pick(hotspotPool);
  }
  return pick(BANGALORE_LOCATIONS);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomEventTime(daysBack = 10) {
  const now = Date.now();
  const past = now - daysBack * 24 * 60 * 60 * 1000;
  return new Date(randomInt(past, now)).toISOString();
}

function locationDetailsFrom(loc) {
  return {
    lat: String(loc.latitude),
    lon: String(loc.longitude),
    name: "",
    type: "residential",
    osm_id: randomInt(200000000, 299999999),
    licence:
      "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright",
    category: "highway",
    osm_type: "way",
    place_id: randomInt(200000000, 299999999),
    importance: 0.0534042778667887,
    place_rank: 26,
    addresstype: "road",
    boundingbox: [
      String((loc.latitude - 0.001).toFixed(7)),
      String((loc.latitude + 0.001).toFixed(7)),
      String((loc.longitude - 0.001).toFixed(7)),
      String((loc.longitude + 0.001).toFixed(7)),
    ],
    display_name: loc.locationLabel,
    address: {
      county: loc.district.includes("Rural")
        ? "Devanahalli taluku"
        : "Yelahanka taluku",
      village: loc.pincode === "560064" ? "Avalahalli" : undefined,
      city_district: loc.pincode === "560064" ? "Avalahalli" : undefined,
      city: "Bengaluru",
      state: "Karnataka",
      state_district: loc.district,
      postcode: loc.pincode,
      country: "India",
      country_code: "in",
      "ISO3166-2-lvl4": "IN-KA",
    },
  };
}

async function post(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Failed ${path}: ${response.status} ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function seedDoctorEvents() {
  for (let i = 0; i < TOTAL_PER_TYPE; i += 1) {
    const location = pickLocation();
    const isHotspot = HOTSPOT_PINCODES.has(location.pincode);

    await post("/api/doctor-events", {
      doctorUserId: null,
      facilityId: null,
      diseaseLabel: pick(DISEASES),
      antibioticName: pick(ANTIBIOTICS),
      quantity: isHotspot ? randomInt(12, 40) : randomInt(1, 10),
      eventTime: randomEventTime(),
      district: location.district,
      pincode: location.pincode,
      latitude: location.latitude,
      longitude: location.longitude,
      locationLabel: location.locationLabel,
      locationDetails: locationDetailsFrom(location),
    });
  }
}

async function seedPharmacyEvents() {
  for (let i = 0; i < TOTAL_PER_TYPE; i += 1) {
    const location = pickLocation();
    const isHotspot = HOTSPOT_PINCODES.has(location.pincode);

    await post("/api/pharmacy-sales", {
      pharmacyUserId: null,
      facilityId: null,
      productName: pick(PRODUCTS),
      antibioticName: pick(ANTIBIOTICS),
      quantity: isHotspot ? randomInt(15, 60) : randomInt(2, 22),
      eventTime: randomEventTime(),
      district: location.district,
      pincode: location.pincode,
      latitude: location.latitude,
      longitude: location.longitude,
      locationLabel: location.locationLabel,
      locationDetails: locationDetailsFrom(location),
    });
  }
}

async function main() {
  console.log(
    `Seeding ${TOTAL_PER_TYPE * 2} Bangalore records to ${API_BASE_URL}...`,
  );
  await seedDoctorEvents();
  await seedPharmacyEvents();
  console.log(
    `Done. Inserted ${TOTAL_PER_TYPE} doctor events and ${TOTAL_PER_TYPE} pharmacy events.`,
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
