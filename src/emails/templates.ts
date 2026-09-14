export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const wrap = (title: string, bodyHtml: string) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>${title}</h2>
    ${bodyHtml}
    <p style="color:#64748b;font-size:12px;margin-top:32px;">FX Bot Market</p>
  </div>
`;

export function buildWelcomeEmail(name: string): EmailTemplate {
  return {
    subject: "Welcome to FX Bot Market",
    html: wrap("Welcome to FX Bot Market", `<p>Hi ${name}, your account is ready. Browse the marketplace to find your first EA or indicator.</p>`),
    text: `Hi ${name}, welcome to FX Bot Market. Your account is ready.`,
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
    subject: "Your FX Bot Market order is confirmed",
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
