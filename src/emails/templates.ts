export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const wrap = (title: string, bodyHtml: string) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>${title}</h2>
    ${bodyHtml}
    <p style="color:#64748b;font-size:12px;margin-top:32px;">fx Bot Hub</p>
  </div>
`;

export function buildWelcomeEmail(name: string): EmailTemplate {
  return {
    subject: "Welcome to fx Bot Hub",
    html: wrap("Welcome to fx Bot Hub", `<p>Hi ${name}, your account is ready. Browse the marketplace to find your first EA or indicator.</p>`),
    text: `Hi ${name}, welcome to fx Bot Hub. Your account is ready.`,
  };
}

export function buildProductApprovedEmail(productName: string, productUrl: string): EmailTemplate {
  return {
    subject: `"${productName}" was approved`,
    html: wrap("Your product is live", `<p>"${productName}" passed review and is now published.</p><p><a href="${productUrl}">View listing</a></p>`),
    text: `"${productName}" passed review and is now published: ${productUrl}`,
  };
}

export function buildProductRejectedEmail(productName: string, reason: string | undefined): EmailTemplate {
  return {
    subject: `"${productName}" needs changes`,
    html: wrap("Your product needs changes", `<p>"${productName}" did not pass review.</p>${reason ? `<p>Reason: ${reason}</p>` : ""}`),
    text: `"${productName}" did not pass review.${reason ? ` Reason: ${reason}` : ""}`,
  };
}

export function buildOrderPaidEmail(orderId: string, ordersUrl: string): EmailTemplate {
  return {
    subject: "Your fx Bot Hub order is confirmed",
    html: wrap(
      "Order confirmed",
      `<p>Order #${orderId.slice(0, 8)} is paid. Your purchases are ready to download.</p><p><a href="${ordersUrl}">View your orders</a></p>`
    ),
    text: `Order #${orderId.slice(0, 8)} is paid. View your orders: ${ordersUrl}`,
  };
}

export function buildSaleNotificationEmail(productName: string, amountCents: number, currency: string): EmailTemplate {
  const amount = (amountCents / 100).toFixed(2);
  return {
    subject: `You made a sale: "${productName}"`,
    html: wrap("New sale", `<p>"${productName}" just sold for ${amount} ${currency}.</p>`),
    text: `"${productName}" just sold for ${amount} ${currency}.`,
  };
}

export function buildPriceChangeEmail(productName: string, productUrl: string, newPrice: string): EmailTemplate {
  return {
    subject: `Price update: "${productName}"`,
    html: wrap("Price updated", `<p>"${productName}" is now ${newPrice}.</p><p><a href="${productUrl}">View listing</a></p>`),
    text: `"${productName}" is now ${newPrice}: ${productUrl}`,
  };
}

export function buildNewVersionEmail(productName: string, version: string, productUrl: string): EmailTemplate {
  return {
    subject: `New version of "${productName}"`,
    html: wrap("New version available", `<p>"${productName}" was updated to version ${version}.</p><p><a href="${productUrl}">View listing</a></p>`),
    text: `"${productName}" was updated to version ${version}: ${productUrl}`,
  };
}

export function buildDownloadAvailableEmail(productName: string, downloadUrl: string): EmailTemplate {
  return {
    subject: `Download ready: "${productName}"`,
    html: wrap("Your download is ready", `<p>"${productName}" is ready to download.</p><p><a href="${downloadUrl}">View your order</a></p>`),
    text: `"${productName}" is ready to download: ${downloadUrl}`,
  };
}

export function buildPaymentFailedEmail(orderId: string, retryUrl: string): EmailTemplate {
  return {
    subject: "Your fx Bot Hub payment did not go through",
    html: wrap(
      "Payment failed",
      `<p>We couldn't process payment for order #${orderId.slice(0, 8)}. No charge was made.</p><p><a href="${retryUrl}">Try again</a></p>`
    ),
    text: `Payment for order #${orderId.slice(0, 8)} did not go through. No charge was made. Try again: ${retryUrl}`,
  };
}

export function buildSubscriptionStartedEmail(productName: string, subscriptionsUrl: string): EmailTemplate {
  return {
    subject: `Subscription started: "${productName}"`,
    html: wrap(
      "Subscription active",
      `<p>Your subscription to "${productName}" is active. You'll be billed automatically each period unless you cancel.</p><p><a href="${subscriptionsUrl}">Manage subscription</a></p>`
    ),
    text: `Your subscription to "${productName}" is active. Manage it: ${subscriptionsUrl}`,
  };
}

export function buildSubscriptionEndingEmail(productName: string, endsAt: string, subscriptionsUrl: string): EmailTemplate {
  return {
    subject: `Your "${productName}" subscription is ending`,
    html: wrap(
      "Subscription ending soon",
      `<p>Your subscription to "${productName}" is set to end on ${endsAt}.</p><p><a href="${subscriptionsUrl}">Manage subscription</a></p>`
    ),
    text: `Your subscription to "${productName}" ends on ${endsAt}. Manage it: ${subscriptionsUrl}`,
  };
}

export function buildRefundEmail(productName: string, amountCents: number, currency: string): EmailTemplate {
  const amount = (amountCents / 100).toFixed(2);
  return {
    subject: `Refund processed: "${productName}"`,
    html: wrap("Refund processed", `<p>Your refund of ${amount} ${currency} for "${productName}" has been processed.</p>`),
    text: `Your refund of ${amount} ${currency} for "${productName}" has been processed.`,
  };
}

export function buildSellerRefundNoticeEmail(productName: string, amountCents: number, currency: string): EmailTemplate {
  const amount = (amountCents / 100).toFixed(2);
  return {
    subject: `Refund issued: "${productName}"`,
    html: wrap(
      "Sale refunded",
      `<p>A ${amount} ${currency} sale of "${productName}" was refunded. Your seller balance has been adjusted accordingly.</p>`
    ),
    text: `A ${amount} ${currency} sale of "${productName}" was refunded. Your seller balance has been adjusted.`,
  };
}

export function buildPayoutEmail(amountCents: number, currency: string, status: "PROCESSING" | "PAID"): EmailTemplate {
  const amount = (amountCents / 100).toFixed(2);
  const verb = status === "PAID" ? "has been paid out" : "is being processed";
  return {
    subject: `Payout ${status === "PAID" ? "sent" : "processing"}: ${amount} ${currency}`,
    html: wrap(`Payout ${status === "PAID" ? "sent" : "processing"}`, `<p>Your payout of ${amount} ${currency} ${verb}.</p>`),
    text: `Your payout of ${amount} ${currency} ${verb}.`,
  };
}
