import React, { useContext, useState, useRef } from "react";
import { DataContext } from "../context/DataContext";
import Pos from "../components/POS";
import Receipt from "../components/Receipt";
import { useReactToPrint } from "react-to-print";
import { toast } from "react-hot-toast";

export default function PosPage() {
  const { inventory, sales, recordSale, customers, addCustomer } = useContext(DataContext);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const receiptRef = useRef();

  // Calculate total revenue
  const totalRevenue = sales.reduce((acc, s) => acc + (s.totalPrice || 0), 0);

  // Check expiry
  const isExpired = (date) => date && new Date(date) < new Date();

  // Handle print
  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    onAfterPrint: () => setShowReceipt(false)
  });

  // Handle multi-item sale (Updated for Phase 2)
  const handleSale = ({ items, paymentMethod, subTotal, totalToPay, customerId, customerName }) => {
    const now = new Date();
    const newSales = [];
    
    // Prepare transaction object for Receipt
    const transaction = {
        items,
        paymentMethod,
        subTotal,
        totalToPay,
        customerName: customerName, // Pass to receipt
        date: now.toLocaleString(),
        receiptNo: `REC-${Date.now().toString().slice(-6)}`
    };

    items.forEach((item) => {
      // Find item in inventory
      const invItem = inventory.find((i) => i.id === item.id);
      if (!invItem) return;

      newSales.push({
        medicineId: invItem.id,
        customerId: customerId, // Link to customer
        name: invItem.name,
        quantity: item.quantity,
        totalPrice: item.price * item.quantity,
        totalCost: 0, 
        paymentMethod: paymentMethod,
        taxAmount: 0,
        date: now.toLocaleString(),
        receiptNumber: transaction.receiptNo
      });
    });

    recordSale(newSales).then((res) => {
        if (res && res.success) {
            setLastTransaction(transaction);
            setShowReceipt(true);
            toast.success("Sale completed successfully!");
        } else {
            // Fallback if API fails (or mocking) for now, but ideally show error
            // setLastTransaction(transaction);
            // setShowReceipt(true);
            toast.error("Failed to record sale. Please try again.");
        }
    });
  };

  // Reset POS sales data
  const resetPosData = () => {
    alert("Reset feature is currently disabled with backend integration.");
  };

  return (
    <>
        <div style={{ display: "none" }}>{/* Hidden container for print source */}
            <div ref={receiptRef}>
                <Receipt transaction={lastTransaction} />
            </div>
        </div>

        <Pos
        inventory={inventory}
        setInventory={() => {}} 
        sales={sales}
        setSales={() => {}} 
        handleSale={handleSale}
        totalRevenue={totalRevenue}
        setTotalRevenue={() => {}}
        resetPosData={resetPosData}
        isExpired={isExpired}
        customers={customers}
        addCustomer={addCustomer}
        />

        {/* Receipt Modal (Display Only) */}
        {showReceipt && (
             <div className="modal-overlay" style={{
                position: 'fixed', top:0, left:0, right:0, bottom:0, 
                background: 'rgba(0,0,0,0.5)', display:'flex', 
                justifyContent:'center', alignItems:'center', zIndex: 2000
            }}>
                <div className="modal-content" style={{
                    background: 'white', padding: '2rem', borderRadius: '12px', textAlign:'center'
                }}>
                    <h2>Sale Completed!</h2>
                    <p>Would you like to print the receipt?</p>
                    
                    {/* The receipt content - visual preview */}
                    <div style={{margin: '20px auto', border: '1px solid #ddd', display: 'inline-block'}}>
                        <Receipt transaction={lastTransaction} />
                    </div>

                    <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem'}}>
                        <button 
                            onClick={() => setShowReceipt(false)}
                            style={{padding: '10px 20px', cursor:'pointer'}}
                        >
                            Close
                        </button>
                        <button 
                            onClick={handlePrint}
                            style={{padding: '10px 20px', background:'var(--primary)', color:'white', border:'none', borderRadius:'6px', cursor:'pointer'}}
                        >
                            Print Receipt
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
}
