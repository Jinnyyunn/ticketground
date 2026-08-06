// Corporate seller login accounts, issued by an admin once a seller
// application has been APPROVED. Kept separate from db.adminAccounts (a
// seller account is scoped to its own events only, not the whole console)
// and from db.sellerApplications (the pre-account one-shot application form).
import crypto from "node:crypto";

const usernamePattern = /^[a-z0-9._-]{3,64}$/;

export function createSellerAccountBackend({ appendLedger, httpError, id, now }) {
  function passwordRecord(password) {
    const value = String(password || "");
    if (value.length < 12) throw httpError(422, "WEAK_SELLER_PASSWORD", "비밀번호는 12자 이상이어야 합니다.");
    const passwordSalt = crypto.randomBytes(16).toString("hex");
    const passwordHash = crypto.scryptSync(value, passwordSalt, 64).toString("hex");
    return { passwordHash, passwordSalt };
  }

  function passwordMatches(account, password) {
    if (!account.passwordHash || !account.passwordSalt) return false;
    const expected = Buffer.from(account.passwordHash, "hex");
    const actual = Buffer.from(crypto.scryptSync(String(password || ""), account.passwordSalt, 64).toString("hex"), "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  function generateTempPassword() {
    return crypto.randomBytes(9).toString("base64url");
  }

  function sellerAccountDto(account) {
    return {
      id: account.id,
      applicationId: account.applicationId,
      organizationName: account.organizationName,
      username: account.username,
      active: account.active !== false,
      mustChangePassword: account.mustChangePassword === true,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    };
  }

  function findApplicationOrThrow(db, applicationId) {
    const application = db.sellerApplications.find((item) => item.id === applicationId);
    if (!application) throw httpError(404, "SELLER_APPLICATION_NOT_FOUND", "판매자 신청을 찾을 수 없습니다.");
    return application;
  }

  function issueSellerAccount(db, { applicationId, username }, actor) {
    const application = findApplicationOrThrow(db, applicationId);
    if (application.status !== "APPROVED") {
      throw httpError(409, "SELLER_APPLICATION_NOT_APPROVED", "승인된 신청에만 계정을 발급할 수 있습니다.");
    }
    if (db.sellerAccounts.some((item) => item.applicationId === applicationId)) {
      throw httpError(409, "SELLER_ACCOUNT_ALREADY_ISSUED", "이미 이 신청에 발급된 계정이 있습니다.");
    }
    const cleanUsername = String(username || "").trim().toLowerCase();
    if (!usernamePattern.test(cleanUsername)) {
      throw httpError(422, "INVALID_SELLER_USERNAME", "아이디는 영문 소문자, 숫자, . _ - 로 3~64자여야 합니다.");
    }
    if (db.sellerAccounts.some((item) => item.username === cleanUsername)) {
      throw httpError(409, "SELLER_ACCOUNT_USERNAME_EXISTS", "이미 사용 중인 아이디입니다.");
    }
    const tempPassword = generateTempPassword();
    const at = now();
    const account = {
      id: id("seller"),
      applicationId,
      organizationName: application.organization.legalName,
      username: cleanUsername,
      ...passwordRecord(tempPassword),
      mustChangePassword: true,
      active: true,
      createdAt: at,
      updatedAt: at
    };
    db.sellerAccounts.push(account);
    appendLedger(db, actor?.id || "ADMIN", "SELLER_ACCOUNT_ISSUED", {
      accountId: account.id,
      applicationId,
      username: account.username
    });
    return { account: sellerAccountDto(account), tempPassword };
  }

  function authenticateSellerAccount(db, username, password) {
    const cleanUsername = String(username || "").trim().toLowerCase();
    const account = db.sellerAccounts.find((item) => item.username === cleanUsername);
    if (!account || account.active === false || !passwordMatches(account, password)) return null;
    return account;
  }

  function activeSellerAccount(db, sellerId) {
    return db.sellerAccounts.find((account) => account.id === sellerId && account.active !== false) || null;
  }

  function changeSellerPassword(db, { sellerId, currentPassword, nextPassword }) {
    const account = activeSellerAccount(db, sellerId);
    if (!account) throw httpError(404, "SELLER_ACCOUNT_NOT_FOUND", "판매자 계정을 찾을 수 없습니다.");
    if (!passwordMatches(account, currentPassword)) {
      throw httpError(401, "SELLER_PASSWORD_MISMATCH", "현재 비밀번호가 일치하지 않습니다.");
    }
    Object.assign(account, passwordRecord(nextPassword));
    account.mustChangePassword = false;
    account.updatedAt = now();
    appendLedger(db, account.id, "SELLER_ACCOUNT_PASSWORD_CHANGED", { accountId: account.id });
    return sellerAccountDto(account);
  }

  return {
    activeSellerAccount,
    authenticateSellerAccount,
    changeSellerPassword,
    issueSellerAccount,
    sellerAccountDto
  };
}
