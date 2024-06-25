import React, { useState } from 'react';
import Modal from './Modal';
import Web3 from 'web3';

const Card = ({ invoice, onPay }) => {
  const [showModal, setShowModal] = useState(false);

  const handlePayClick = () => {
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleModalSubmit = async (amount) => {
    if (!amount || isNaN(amount) || amount <= 0) {
      console.error('Invalid payment amount');
      return;
    }

    try {
      if (window.ethereum) {
        const web3 = new Web3(window.ethereum);
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const accounts = await web3.eth.getAccounts();
        const walletAddress = accounts[0];

        const amountInWei = web3.utils.toWei(amount, 'ether');
        const gasPrice = await web3.eth.getGasPrice();
        const gasEstimate = await web3.eth.estimateGas({
          from: walletAddress,
          to: invoice.formidium_address,
          value: amountInWei,
        });

        const transaction = await web3.eth.sendTransaction({
          from: walletAddress,
          to: invoice.formidium_address,
          value: amountInWei,
          gas: gasEstimate,
          gasPrice: gasPrice,
        });

        const transactionHash = transaction.transactionHash;

        const response = await fetch(`http://localhost:5000/invoices/${invoice.id}/payment`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amountPaid: parseFloat(amount).toFixed(5), // Ensure decimal format
            walletAddress: walletAddress,
            transactionHash: transactionHash,
          }),
        });

        const data = await response.json();
        console.log('Invoice updated:', data);

        if (data.error) {
          console.error('Error updating invoice:', data.error);
        } else {
          console.log('Payment ID:', data.paymentId);
          alert(`Payment successful! Payment ID: ${data.paymentId}`);
          onPay(invoice.id);
        }
      } else {
        console.error('MetaMask is not installed');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
    } finally {
      setShowModal(false);
    }
  };

  return (
    <div className="card">
      <div className="max-w-xs rounded-3xl overflow-hidden shadow-lg bg-white m-4" style={{ borderColor: '#aa2bff' }}>
        <div className="bg-purple-900 text-white text-center py-4">
          <h2 className="text-2xl font-semibold">{invoice.id}</h2>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-x-4 overflow-y-auto max-h-96"> {/* Grid for two columns with scrollable content */}
          <div className="mb-4">
            <span className="block text-gray-700 font-bold">Invoice Category:</span>
            <span className="block text-gray-900 overflow-hidden">{invoice.invoiceCategory}</span>
          </div>
          <div className="mb-4">
            <span className="block text-gray-700 font-bold">Payment Due:</span>
            <span className="block text-gray-900 overflow-hidden">{invoice.paymentDue}</span>
          </div>
          <div className="mb-4">
            <span className="block text-gray-700 font-bold">Company Name:</span>
            <span className="block text-gray-900 overflow-hidden">{invoice.companyName}</span>
          </div>
          <div className="mb-4">
            <span className="block text-gray-700 font-bold">Recipient Address:</span>
            <span className="block text-gray-900 overflow-hidden">{invoice.recipientAddress}</span>
          </div>
          <div className="mb-4">
            <span className="block text-gray-700 font-bold">Cryptocurrency:</span>
            <span className="block text-gray-900 overflow-hidden">{invoice.cryptocurrency}</span>
          </div>
          <div className="mb-4">
            <span className="block text-gray-700 font-bold">Due Date:</span>
            <span className="block text-gray-900 overflow-hidden">{invoice.dueDate}</span>
          </div>
          <div className="mb-4">
            <span className="block text-gray-700 font-bold">Description:</span>
            <span className="block text-gray-900 overflow-hidden">{invoice.description}</span>
          </div>
          <div className="mb-4">
            <span className="block text-gray-700 font-bold">Company Email:</span>
            <span className="block text-gray-900 overflow-hidden">{invoice.companyEmail}</span>
          </div>
        </div>
        <div className="flex justify-center mb-6"> {/* Adjusted margin-top to 6 for more space */}
          <button
            className="text-white font-bold py-2 px-4 rounded-full border hover:border-black hover:bg-gray-200 hover:text-gray-900 transition duration-300 ease-in-out"
            onClick={handlePayClick}
          >
            Pay
          </button>
        </div>
      </div>
      <Modal show={showModal} onClose={handleModalClose} onSubmit={handleModalSubmit} />
    </div>
  );
};

export default Card;
