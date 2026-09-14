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
