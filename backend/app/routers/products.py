import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from typing import List, Dict, Optional
from bson import ObjectId
from app.database import get_database
from app.models.product import ProductResponse, ProductCategory
from app.utils.helpers import convert_objectid_to_str
from app.services.file_service import save_upload_file, delete_file
from app.dependencies.auth import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/products", tags=["products"])

# Public-facing category order. Anything with an unknown category is dropped
# from /by-category rather than silently rendered under the wrong heading.
CATEGORY_KEYS = [c.value for c in ProductCategory]


def _shape(doc: dict) -> dict:
    """Mongo document -> ProductResponse kwargs."""
    doc = convert_objectid_to_str(doc)
    doc["id"] = doc.pop("_id")
    return doc


def _sort_products(products: List[dict]) -> List[dict]:
    """Featured first, then curated order, then name."""
    return sorted(
        products,
        key=lambda p: (
            not p.get("featured", False),
            p.get("display_order") or 999,
            p.get("name", ""),
        ),
    )


@router.post("/", response_model=ProductResponse, status_code=201, dependencies=[Depends(require_admin)])
async def create_product(
    name: str = Form(...),
    category: ProductCategory = Form(...),
    brand: str = Form(""),
    model: str = Form(""),
    product_group: str = Form(""),
    spec_line: str = Form(""),
    description: str = Form(""),
    sku: str = Form(""),
    featured: bool = Form(False),
    active: bool = Form(True),
    display_order: int = Form(999),
    image: Optional[UploadFile] = File(None),
):
    """Create a product with an optional photo."""

    db = get_database()

    image_url = None
    if image:
        image_url = await save_upload_file(image, folder="products")

    product_dict = {
        "name": name,
        "category": category.value,
        "brand": brand,
        "model": model,
        "product_group": product_group,
        "spec_line": spec_line,
        "description": description,
        "sku": sku,
        "featured": featured,
        "active": active,
        "display_order": display_order,
        "image_url": image_url,
    }

    result = await db.products.insert_one(product_dict)
    created = await db.products.find_one({"_id": result.inserted_id})

    return ProductResponse(**_shape(created))


@router.get("/", response_model=List[ProductResponse])
async def list_products(active_only: bool = True, category: Optional[str] = None):
    """List products, newest curated order first."""

    db = get_database()

    query = {"active": True} if active_only else {}
    if category:
        query["category"] = category

    cursor = db.products.find(query)
    products = await cursor.to_list(length=None)

    return [ProductResponse(**_shape(p)) for p in _sort_products(products)]


@router.get("/by-category", response_model=Dict[str, List[ProductResponse]])
async def get_products_by_category(active_only: bool = True):
    """Products grouped by category, for the public catalogue page.

    NOTE: declared before /{product_id} so "by-category" is never parsed as an ID.
    """

    db = get_database()

    query = {"active": True} if active_only else {}
    cursor = db.products.find(query)
    products = await cursor.to_list(length=None)

    categorized: Dict[str, List[ProductResponse]] = {key: [] for key in CATEGORY_KEYS}

    for product in _sort_products(products):
        category = product.get("category")
        if category in categorized:
            categorized[category].append(ProductResponse(**_shape(product)))

    return categorized


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str):
    """Get a single product by ID."""

    db = get_database()

    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID format")

    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return ProductResponse(**_shape(product))


@router.put("/{product_id}", response_model=ProductResponse, dependencies=[Depends(require_admin)])
async def update_product(
    product_id: str,
    name: Optional[str] = Form(None),
    category: Optional[ProductCategory] = Form(None),
    brand: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    product_group: Optional[str] = Form(None),
    spec_line: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    sku: Optional[str] = Form(None),
    featured: Optional[bool] = Form(None),
    active: Optional[bool] = Form(None),
    display_order: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
):
    """Update a product; sending a new image replaces (and deletes) the old one."""

    db = get_database()

    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID format")

    update_data = {}
    for field, value in [
        ("name", name), ("brand", brand), ("model", model),
        ("product_group", product_group), ("spec_line", spec_line),
        ("description", description), ("sku", sku), ("featured", featured),
        ("active", active), ("display_order", display_order),
    ]:
        if value is not None:
            update_data[field] = value

    if category is not None:
        update_data["category"] = category.value

    if image:
        current = await db.products.find_one({"_id": ObjectId(product_id)})
        if current and current.get("image_url"):
            try:
                await delete_file(current["image_url"])
            except Exception as e:
                logger.warning(f"Could not delete old product image {current['image_url']}: {e}")
        update_data["image_url"] = await save_upload_file(image, folder="products")

    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    result = await db.products.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": update_data},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")

    updated = await db.products.find_one({"_id": ObjectId(product_id)})
    return ProductResponse(**_shape(updated))


@router.delete("/{product_id}", status_code=204, dependencies=[Depends(require_admin)])
async def delete_product(product_id: str):
    """Soft delete (active=False) so a discontinued tool keeps its history."""

    db = get_database()

    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID format")

    result = await db.products.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": {"active": False}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")

    return None
