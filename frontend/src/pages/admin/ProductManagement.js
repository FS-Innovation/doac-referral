import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pointCost: '',
    imageUrl: '',
    isActive: true
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await adminAPI.getAllProducts();
      setProducts(response.data.products);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      if (editingProduct) {
        await adminAPI.updateProduct(editingProduct.id, formData);
        setMessage({ type: 'success', text: 'Product updated successfully' });
      } else {
        await adminAPI.createProduct(formData);
        setMessage({ type: 'success', text: 'Product created successfully' });
      }
      resetForm();
      loadProducts();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Operation failed' });
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      pointCost: product.pointCost,
      imageUrl: product.imageUrl || '',
      isActive: product.isActive
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await adminAPI.deleteProduct(id);
      setMessage({ type: 'success', text: 'Product deleted successfully' });
      loadProducts();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete product' });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      pointCost: '',
      imageUrl: '',
      isActive: true
    });
    setEditingProduct(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <h1>Product Management</h1>

      {message.text && (
        <div className={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </div>
      )}

      <button
        onClick={() => setShowForm(!showForm)}
        className="btn btn-primary"
        style={{ marginBottom: '20px' }}
      >
        {showForm ? 'Cancel' : 'Add New Product'}
      </button>

      {showForm && (
        <div className="card">
          <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Point Cost *</label>
              <input
                type="number"
                value={formData.pointCost}
                onChange={(e) => setFormData({ ...formData, pointCost: e.target.value })}
                required
                min="1"
              />
            </div>
            <div className="form-group">
              <label>Image URL</label>
              <input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ width: 'auto', marginRight: '10px' }}
                />
                Active
              </label>
            </div>
            <button type="submit" className="btn btn-primary">
              {editingProduct ? 'Update Product' : 'Create Product'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="btn btn-secondary"
              style={{ marginLeft: '10px' }}
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>All Products</h2>
        {products.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Point Cost</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td style={{ maxWidth: '300px' }}>{product.description}</td>
                  <td>{product.pointCost}</td>
                  <td>{product.isActive ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(product)}
                      className="btn btn-primary"
                      style={{ marginRight: '5px', padding: '5px 10px' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="btn btn-danger"
                      style={{ padding: '5px 10px' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No products found</p>
        )}
      </div>
    </div>
  );
};

export default ProductManagement;
