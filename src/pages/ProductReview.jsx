
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./ProductReview.css";

const API = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

const REVIEW_API = `${API}/internal/product-reviews`;

const getToken = () =>
  localStorage.getItem("access_token") ||
  localStorage.getItem("auth_token") ||
  localStorage.getItem("sellerAccessToken");

const getAuthConfig = () => ({
  headers: {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

const getErrorMessage = (error) => {
  const data = error?.response?.data;

  if (typeof data === "string") return data;

  if (data?.detail) return data.detail;
  if (data?.message) return data.message;

  if (data && typeof data === "object") {
    return Object.entries(data)
      .map(([key, value]) => {
        const message = Array.isArray(value)
          ? value.join(", ")
          : typeof value === "string"
          ? value
          : JSON.stringify(value);

        return `${key}: ${message}`;
      })
      .join(" | ");
  }

  if (error?.code === "ECONNABORTED") {
    return "The request timed out. Please try again.";
  }

  if (!error?.response) {
    return "Cannot connect to the server. Check your internet connection.";
  }

  return "Something went wrong. Please try again.";
};

const getImageUrl = (image) => {
  if (!image) return "";

  let value =
    typeof image === "string"
      ? image
      : image.image_url || image.image || image.url || "";

  if (typeof value !== "string" || !value.trim()) return "";

  value = value.trim();

  if (/^(data:|javascript:|\/\/)/i.test(value)) return "";

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);

      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return "";
      }

      return value;
    } catch {
      return "";
    }
  }

  const mediaBase = (
    import.meta.env.VITE_MEDIA_URL ||
    API.replace(/\/api\/?$/, "")
  ).replace(/\/+$/, "");

  return `${mediaBase}/${value.replace(/^\/+/, "")}`;
};

const humanize = (value) => {
  if (!value) return "Not provided";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const getProductStatus = (data) => {
  const product =
    data?.product ||
    data?.product_details ||
    data?.verification?.product ||
    data;

  return (
    product?.status ||
    data?.product_status ||
    data?.verification_status ||
    data?.verification?.status ||
    ""
  ).toLowerCase();
};

const getAssignmentStatus = (data) =>
  (
    data?.assignment_status ||
    data?.assignment?.status ||
    data?.review?.assignment_status ||
    ""
  ).toLowerCase();

const getProductFromResponse = (data) =>
  data?.product ||
  data?.product_details ||
  data?.verification?.product ||
  data;

export default function ProductReview() {
  const { productId } = useParams();
  const navigate = useNavigate();

  const [responseData, setResponseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [imageError, setImageError] = useState(false);

  const product = useMemo(
    () => getProductFromResponse(responseData),
    [responseData]
  );

  const assignmentStatus = getAssignmentStatus(responseData);
  const productStatus = getProductStatus(responseData);

  const isCompleted =
    responseData?.is_completed === true ||
    ["completed", "complete"].includes(assignmentStatus);

  const canStart =
    responseData?.can_start_review === true ||
    ["assigned"].includes(assignmentStatus);

  const canTakeAction =
    !isCompleted &&
    (responseData?.can_take_action === true ||
      ["in_review"].includes(assignmentStatus));

  const images = useMemo(() => {
    const rawImages = [
      ...(Array.isArray(product?.images) ? product.images : []),
      ...(Array.isArray(product?.product_images)
        ? product.product_images
        : []),
    ];

    if (product?.image) rawImages.unshift(product.image);
    if (product?.image_url) rawImages.unshift(product.image_url);

    const unique = [];
    const seen = new Set();

    rawImages.forEach((item) => {
      const url = getImageUrl(item);

      if (url && !seen.has(url)) {
        seen.add(url);
        unique.push(url);
      }
    });

    return unique;
  }, [product]);

  const loadProduct = useCallback(async () => {
    if (!productId) {
      setError("Product ID is missing from the page URL.");
      setLoading(false);
      return;
    }

    if (!getToken()) {
      setError("Your session has expired. Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.get(
        `${REVIEW_API}/${encodeURIComponent(productId)}/`,
        getAuthConfig()
      );

      if (!response.data || typeof response.data !== "object") {
        throw new Error("The server returned an invalid product response.");
      }

      setResponseData(response.data);
      setReason("");

      const firstImage = getImageUrl(
        getProductFromResponse(response.data)?.images?.[0] ||
          getProductFromResponse(response.data)?.image
      );

      setSelectedImage(firstImage);
      setImageError(false);
    } catch (err) {
      console.error("Failed to load product review:", {
        status: err.response?.status,
        message: err.message,
      });

      setError(
        err.response?.status === 401
          ? "Your session has expired. Please sign in again."
          : getErrorMessage(err)
      );
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const performAction = async (action) => {
    if (actionLoading) return;

    setError("");
    setNotice("");

    if (!getToken()) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    if (action === "start" && !canStart) {
      setError("This review cannot be started in its current state.");
      return;
    }

    if (action !== "start" && !canTakeAction) {
      setError("This review is not currently available for action.");
      return;
    }

    if (["reject", "request-changes"].includes(action) && !reason.trim()) {
      setError(
        action === "reject"
          ? "Please enter a reason before rejecting this product."
          : "Please describe the changes required from the seller."
      );
      return;
    }

    const payload =
      action === "reject" || action === "request-changes"
        ? { reason: reason.trim(), comments: reason.trim() }
        : {};

    setActionLoading(true);

    try {
      const response = await axios.post(
        `${REVIEW_API}/${encodeURIComponent(productId)}/${action}/`,
        payload,
        getAuthConfig()
      );

      if (action === "start") {
        setNotice("Review started successfully.");
        await loadProduct();
        return;
      }

      const finalProductStatus = {
        approve: "approved",
        reject: "rejected",
        "request-changes": "changes_required",
      }[action];

      // Keep the current page visible. The backend is the source of truth.
      // Refresh from the backend after the successful action.
      setResponseData((previous) => {
        if (!previous) return previous;

        const productKey = previous.product
          ? "product"
          : previous.product_details
          ? "product_details"
          : null;

        const updatedProduct = productKey
          ? {
              ...previous[productKey],
              status: finalProductStatus,
            }
          : {
              ...previous,
              status: finalProductStatus,
            };

        return {
          ...previous,
          assignment_status: "completed",
          verification_status: finalProductStatus,
          product_status: finalProductStatus,
          is_completed: true,
          ...(productKey ? { [productKey]: updatedProduct } : updatedProduct),
        };
      });

      setReason("");

      setNotice(
        action === "approve"
          ? "Product approved successfully. The review is complete."
          : action === "reject"
          ? "Product rejected successfully. The review is complete."
          : "Changes requested successfully. The review is complete."
      );

      // Reconcile with the backend without redirecting away.
      if (response?.data && typeof response.data === "object") {
        setResponseData((previous) => ({
          ...(previous || {}),
          ...response.data,
        }));
      }
    } catch (err) {
      console.error("Product review action failed:", {
        action,
        status: err.response?.status,
        message: err.message,
      });

      setError(getErrorMessage(err));

      if ([403, 404, 409].includes(err.response?.status)) {
        try {
          await loadProduct();
        } catch {
          // Keep the current page visible if refreshing fails.
        }
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="review-page">
        <div className="review-loading">
          <span className="review-spinner" />
          <p>Loading product review...</p>
        </div>
      </main>
    );
  }

  if (error && !responseData) {
    return (
      <main className="review-page">
        <section className="review-message-card">
          <div className="review-message-icon error-icon">!</div>
          <h2>Unable to load product review</h2>
          <p>{error}</p>

          <div className="review-message-actions">
            <button
              className="review-btn review-btn-secondary"
              onClick={() => navigate("/product-reviews")}
            >
              Back to Reviews
            </button>

            <button
              className="review-btn review-btn-primary"
              onClick={loadProduct}
            >
              Try Again
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!responseData || !product) {
    return (
      <main className="review-page">
        <section className="review-message-card">
          <h2>Product details unavailable</h2>
          <p>The server did not return product details for this review.</p>
          <button
            className="review-btn review-btn-primary"
            onClick={() => navigate("/product-reviews")}
          >
            Back to Reviews
          </button>
        </section>
      </main>
    );
  }

  const productName =
    product.productname ||
    product.product_name ||
    product.name ||
    "Unnamed Product";

  const price = product.price;
  const category = product.category_name || product.category;
  const seller =
    product.seller_name ||
    product.seller?.business_name ||
    product.seller?.username ||
    product.seller?.email ||
    "Not provided";

  const description = product.description || "No description provided.";

  const variants = Array.isArray(product.variants)
    ? product.variants
    : Array.isArray(responseData.variants)
    ? responseData.variants
    : [];

  return (
    <main className="review-page">
      <div className="review-container">
        <header className="review-header">
          <div>
            <button
              className="review-back-link"
              onClick={() => navigate("/product-reviews")}
            >
              <span aria-hidden="true">←</span> Back to Reviews
            </button>

            <p className="review-eyebrow">CLAYWARE REVIEWER PORTAL</p>
            <h1>Product Verification</h1>
            <p className="review-subtitle">
              Review product details carefully before making a decision.
            </p>
          </div>

          <span
            className={`review-status review-status-${(
              isCompleted ? "completed" : assignmentStatus || productStatus
            )
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")}`}
          >
            {humanize(isCompleted ? "completed" : assignmentStatus || productStatus)}
          </span>
        </header>

        {error && (
          <div className="review-alert review-alert-error" role="alert">
            <span className="review-alert-symbol">!</span>
            <div>
              <strong>Action unsuccessful</strong>
              <p>{error}</p>
            </div>
            <button
              className="review-alert-close"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {notice && (
          <div className="review-alert review-alert-success" role="status">
            <span className="review-alert-symbol">✓</span>
            <div>
              <strong>Success</strong>
              <p>{notice}</p>
            </div>
            <button
              className="review-alert-close"
              onClick={() => setNotice("")}
              aria-label="Dismiss success message"
            >
              ×
            </button>
          </div>
        )}

        <section className="review-product-layout">
          <article className="review-card review-gallery-card">
            <div className="review-card-heading">
              <div>
                <p className="review-section-kicker">PRODUCT MEDIA</p>
                <h2>Product Images</h2>
              </div>
              <span className="review-count">{images.length} images</span>
            </div>

            <div className="review-main-image">
              {selectedImage && !imageError ? (
                <img
                  src={selectedImage}
                  alt={productName}
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="review-no-image">
                  <span aria-hidden="true">▧</span>
                  <p>No product image available</p>
                </div>
              )}
            </div>

            {images.length > 0 && (
              <div className="review-thumbnails">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    className={`review-thumbnail ${
                      selectedImage === image ? "active" : ""
                    }`}
                    onClick={() => {
                      setSelectedImage(image);
                      setImageError(false);
                    }}
                    aria-label={`View product image ${index + 1}`}
                  >
                    <img src={image} alt={`${productName} ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}

            <div className="review-image-note">
              Check image quality, product appearance, and consistency with the
              description.
            </div>
          </article>

          <article className="review-card review-details-card">
            <div className="review-card-heading">
              <div>
                <p className="review-section-kicker">PRODUCT INFORMATION</p>
                <h2>{productName}</h2>
              </div>
            </div>

            <div className="review-product-tags">
              <span className="review-tag">{humanize(category)}</span>
              {product.sku && (
                <span className="review-tag">SKU: {product.sku}</span>
              )}
            </div>

            <div className="review-price">
              {price !== undefined && price !== null ? (
                <>
                  <span className="review-price-label">Selling price</span>
                  <strong>₹{Number(price).toLocaleString("en-IN")}</strong>
                </>
              ) : (
                <>
                  <span className="review-price-label">Selling price</span>
                  <strong>Not provided</strong>
                </>
              )}
            </div>

            <div className="review-detail-grid">
              <div className="review-detail-item">
                <span>Seller</span>
                <strong>{seller}</strong>
              </div>

              <div className="review-detail-item">
                <span>Stock quantity</span>
                <strong>
                  {product.stock_quantity ?? product.stock ?? "Not provided"}
                </strong>
              </div>

              <div className="review-detail-item">
                <span>Capacity</span>
                <strong>{product.capacity || "Not provided"}</strong>
              </div>

              <div className="review-detail-item">
                <span>Weight</span>
                <strong>{product.weight || "Not provided"}</strong>
              </div>

              <div className="review-detail-item">
                <span>Discount price</span>
                <strong>
                  {product.discount_price !== undefined &&
                  product.discount_price !== null
                    ? `₹${Number(product.discount_price).toLocaleString("en-IN")}`
                    : "Not provided"}
                </strong>
              </div>

              <div className="review-detail-item">
                <span>Product status</span>
                <strong>{humanize(productStatus)}</strong>
              </div>
            </div>

            <div className="review-description">
              <h3>Description</h3>
              <p>{description}</p>
            </div>
          </article>
        </section>

        {variants.length > 0 && (
          <section className="review-card review-variants-card">
            <div className="review-card-heading">
              <div>
                <p className="review-section-kicker">OPTIONS</p>
                <h2>Product Variants</h2>
              </div>
              <span className="review-count">{variants.length} variants</span>
            </div>

            <div className="review-variants-list">
              {variants.map((variant, index) => (
                <div
                  className="review-variant"
                  key={variant.id ?? variant.sku ?? index}
                >
                  <div className="review-variant-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="review-variant-content">
                    <strong>
                      {variant.name ||
                        variant.variant_name ||
                        variant.title ||
                        `Variant ${index + 1}`}
                    </strong>
                    <span>
                      SKU: {variant.sku || "Not provided"} · Stock:{" "}
                      {variant.stock_quantity ?? variant.stock ?? "N/A"}
                    </span>
                  </div>

                  <strong className="review-variant-price">
                    {variant.price !== undefined && variant.price !== null
                      ? `₹${Number(variant.price).toLocaleString("en-IN")}`
                      : ""}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="review-card review-decision-card">
          <div className="review-card-heading">
            <div>
              <p className="review-section-kicker">REVIEW DECISION</p>
              <h2>Verification Decision</h2>
              <p className="review-decision-subtitle">
                Record your decision based on the product information above.
              </p>
            </div>
          </div>

          {isCompleted ? (
            <div className="review-completed-panel">
              <div className="review-completed-icon">✓</div>
              <div>
                <h3>Review completed</h3>
                <p>
                  This review is marked as completed. No further actions are
                  available from this page.
                </p>
              </div>
              <button
                className="review-btn review-btn-primary"
                onClick={() => navigate("/product-reviews")}
              >
                Return to Reviews
              </button>
            </div>
          ) : canStart ? (
            <div className="review-start-panel">
              <div>
                <h3>Ready to begin?</h3>
                <p>
                  Start the review before approving, rejecting, or requesting
                  changes.
                </p>
              </div>
              <button
                className="review-btn review-btn-primary"
                disabled={actionLoading}
                onClick={() => performAction("start")}
              >
                {actionLoading ? "Please wait..." : "Start Review"}
              </button>
            </div>
          ) : canTakeAction ? (
            <>
              <label className="review-label" htmlFor="review-reason">
                Reviewer comments
                <span>Required for rejection and change requests</span>
              </label>

              <textarea
                id="review-reason"
                className="review-textarea"
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Enter your reason or describe the changes required..."
                disabled={actionLoading}
                maxLength={2000}
              />

              <div className="review-textarea-footer">
                <span>
                  {reason.length}/2000 characters
                </span>
                <span>Be specific and professional.</span>
              </div>

              <div className="review-action-buttons">
                <button
                  className="review-btn review-btn-approve"
                  disabled={actionLoading}
                  onClick={() => performAction("approve")}
                >
                  {actionLoading ? "Processing..." : "✓ Approve Product"}
                </button>

                <button
                  className="review-btn review-btn-changes"
                  disabled={actionLoading}
                  onClick={() => performAction("request-changes")}
                >
                  {actionLoading ? "Processing..." : "↻ Request Changes"}
                </button>

                <button
                  className="review-btn review-btn-reject"
                  disabled={actionLoading}
                  onClick={() => performAction("reject")}
                >
                  {actionLoading ? "Processing..." : "× Reject Product"}
                </button>
              </div>

              <p className="review-security-note">
                <span aria-hidden="true">🔒</span> Actions are submitted to the
                server and depend on your reviewer permissions.
              </p>
            </>
          ) : (
            <div className="review-start-panel">
              <div>
                <h3>Review actions unavailable</h3>
                <p>
                  The server has not marked this review as ready for action.
                  Refresh the page or return to the review list.
                </p>
              </div>
              <button
                className="review-btn review-btn-secondary"
                onClick={loadProduct}
              >
                Refresh Review
              </button>
            </div>
          )}
        </section>

        <footer className="review-footer">
          <span>ClayWare · Internal Product Verification</span>
          <span>Review ID: {productId}</span>
        </footer>
      </div>
    </main>
  );
}
