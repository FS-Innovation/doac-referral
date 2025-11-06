import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { productAPI, userAPI } from '../services/api';

const Products = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsRes, purchasesRes] = await Promise.all([
        productAPI.getAll(),
        userAPI.getPurchaseHistory()
      ]);
      setProducts(productsRes.data.products);
      setPurchases(purchasesRes.data.purchases);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (productId, productName, pointCost) => {
    if (!window.confirm(`Purchase ${productName} for ${pointCost} points?`)) {
      return;
    }

    try {
      await productAPI.purchase(productId);
      setMessage({ type: 'success', text: 'Purchase successful!' });
      window.location.reload(); // Reload to update points
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Purchase failed'
      });
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <h1>Products</h1>
      <p>Current Points: <strong>{user.points}</strong></p>

      {message.text && (
        <div className={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </div>
      )}

      <h2>Available Products</h2>
      {products.length > 0 ? (
        <div className="product-grid">
          {products.map((product) => (
            <div key={product.id} className="product-card">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  style={{ width: '100%', borderRadius: '5px', marginBottom: '10px' }}
                />
              )}
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <div className="price">{product.pointCost} Points</div>
              <button
                onClick={() => handlePurchase(product.id, product.name, product.pointCost)}
                className="btn btn-primary"
                disabled={user.points < product.pointCost}
                style={{ width: '100%' }}
              >
                {user.points < product.pointCost ? 'Insufficient Points' : 'Purchase'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p>No products available at the moment.</p>
      )}

      <div className="card" style={{ marginTop: '40px' }}>
        <h2>Purchase History</h2>
        {purchases.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Points Spent</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td>{purchase.productName}</td>
                  <td>{purchase.pointsSpent}</td>
                  <td>{new Date(purchase.purchasedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No purchases yet.</p>
        )}
      </div>
    </div>
  );
};

export default Products;
