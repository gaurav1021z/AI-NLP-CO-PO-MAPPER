import os
from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGODB_URI)

db = client["ai_copo_db"]

faculty_collection = db["faculty"]
mapping_collection = db["mapping"]
feedback_collection = db["feedback"]
accuracy_collection = db["accuracy"]
c_collection = db["c_scheme"]
nep_collection = db["nep_collection"]
def get_cos_by_subject(subject_code, schema):
    normalized_code = (subject_code or "").strip()

    if schema == "C":
        collection = c_collection
    else:
        collection = nep_collection

    if not normalized_code:
        return []

    data = list(collection.find({"subject_code": normalized_code}))

    if not data:
        data = list(
            collection.find(
                {"subject_code": {"$regex": f"^{normalized_code}$", "$options": "i"}}
            )
        )

    data.sort(
        key=lambda item: (
            int(item.get("co_number") or 999),
            str(item.get("co_id") or ""),
        )
    )

    print("Found:", len(data), "for", normalized_code, "schema", schema)

    return data
