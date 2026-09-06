import { config } from '../config';

export async function runHybridOcr(productId) {
  try {
    const response = await fetch(`${config.apiUrl}/products/${productId}/ocr/hybrid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Error running hybrid OCR:', error);
    throw error;
  }
}

export async function getProduct(productId) {
  try {
    const response = await fetch(`${config.apiUrl}/products/${productId}`, {
      method: 'GET',
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Error fetching product:', error);
    throw error;
  }
}
