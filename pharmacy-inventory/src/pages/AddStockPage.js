import React, { useState, useContext } from "react";
import { DataContext } from "../context/DataContext";
import AddStock from "../components/AddStock";
import FastImageCapture from "../components/FastImageCapture";
import { apiFetch, getApiErrorMessage } from "../utils/api";
import toast from "react-hot-toast";

export default function AddStockPage() {
  const { fetchInventory, suppliers, inventory, inventoryCategories, inventoryCategoriesError } = useContext(DataContext);
  
  const [items, setItems] = useState([
    { id: Date.now(), name: "", genericName: "", brandName: "", strength: "", packSize: "", unitOfMeasure: "", mainCategoryId: "", subcategoryId: "", productFormId: "", dosage: "", sku: "", costPrice: "", quantity: "", sellingPrice: "", expiryDate: "", batchNumber: "" }
  ]);
  
  const [metadata, setMetadata] = useState({
    supplierId: "",
    invoiceNumber: "",
    orderDate: new Date().toISOString().split('T')[0],
    warehouse: "Main Pharmacy"
  });

  const [showCapture, setShowCapture] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFastSave = async (extractedData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        metadata: {
           supplier: "System Default / Fast Camera",
           warehouse: "Main Pharmacy",
           orderDate: new Date().toISOString().split('T')[0],
           invoiceNumber: "FC-" + Date.now()
        },
        items: [{
           id: Date.now(),
           name: extractedData.productName || "Unknown Box",
           mainCategoryId: extractedData.mainCategoryId,
           subcategoryId: extractedData.subcategoryId || undefined,
           productFormId: extractedData.productFormId || undefined,
           dosage: extractedData.productFormName || undefined,
           sku: "AUTO-" + Math.floor(Math.random() * 1000),
           costPrice: "0",
           sellingPrice: "0",
           quantity: extractedData.quantity || "1",
           expiryDate: extractedData.expiryDate,
           batchNumber: extractedData.batchNumber
        }]
      };

      const res = await apiFetch("/api/inventory/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const saved = await res.json().catch(() => null);
        if (!saved?.success) {
          toast.error("The inventory service returned an unexpected save response.");
          return;
        }
        const refresh = await fetchInventory();
        if (refresh.success) {
          toast.success("Rapid stock capture saved and inventory refreshed.");
        } else {
          toast.error(`Stock was saved, but ${refresh.error.toLowerCase()}`);
        }
        setShowCapture(false);
      } else {
        toast.error(await getApiErrorMessage(res, "Failed to add via capture"));
      }
    } catch (err) {
      toast.error("Network error during rapid add");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (isSubmitting) return;
    // Basic validation
    if (!metadata.supplierId) return toast.error("Please select a verified partner / supplier");
    
    const namedItems = items.filter(i => i.name);
    if (namedItems.some((item) => !item.mainCategoryId)) {
      return toast.error("Select a main category for every product before saving");
    }
    const validItems = namedItems.filter(i => i.quantity > 0);
    if (validItems.length === 0) return toast.error("Please add at least one valid item");

    setIsSubmitting(true);
    try {
      const selectedSupplier = suppliers.find(s => s.id === parseInt(metadata.supplierId));
      
      const res = await apiFetch("/api/inventory/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          items: validItems,
          supplier: selectedSupplier ? selectedSupplier.name : "Unknown",
          warehouse: metadata.warehouse,
          invoiceNumber: metadata.invoiceNumber,
          receivedDate: metadata.orderDate
        })
      });

      if (res.ok) {
        const saved = await res.json().catch(() => null);
        if (!saved?.success) {
          toast.error("The inventory service returned an unexpected save response.");
          return;
        }
        const refresh = await fetchInventory();
        if (refresh.success) {
          toast.success("Stock batch saved and inventory refreshed.");
        } else {
          toast.error(`Stock was saved, but ${refresh.error.toLowerCase()}`);
        }
        handleCancel(); // Reset form
      } else {
        toast.error(await getApiErrorMessage(res, "Failed to import stock"));
      }
    } catch (err) {
      toast.error("Network error during stock import");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setItems([{ id: Date.now(), name: "", genericName: "", brandName: "", strength: "", packSize: "", unitOfMeasure: "", mainCategoryId: "", subcategoryId: "", productFormId: "", dosage: "", sku: "", costPrice: "", quantity: "", sellingPrice: "", expiryDate: "", batchNumber: "" }]);
    setMetadata({
      supplierId: "",
      invoiceNumber: "",
      orderDate: new Date().toISOString().split('T')[0],
      warehouse: "Main Pharmacy"
    });
  };

  return (
    <>
      <AddStock
        items={items}
        setItems={setItems}
        metadata={metadata}
        setMetadata={setMetadata}
        onNext={handleNext}
        onCancel={handleCancel}
        suppliers={suppliers}
        isSubmitting={isSubmitting}
        inventory={inventory}
        categories={inventoryCategories}
        categoriesError={inventoryCategoriesError}
        onFastCapture={() => setShowCapture(true)}
      />
      
      {showCapture && (
          <FastImageCapture 
              onSave={handleFastSave}
              onClose={() => setShowCapture(false)}
              categories={inventoryCategories}
          />
      )}
    </>
  );
}
