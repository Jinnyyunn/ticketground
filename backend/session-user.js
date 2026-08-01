export function publicSessionUser(user) {
  return {
    id: user.id,
    name: user.name,
    status: user.status,
    trustScore: user.trustScore,
    profileConfirmed: Boolean(user.profileConfirmedAt)
  };
}
