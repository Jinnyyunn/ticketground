export function createSessionBackend({ appendLedger, findUser, httpError, now }) {
  function publicSessionUser(user) {
    return {
      id: user.id,
      name: user.name,
      status: user.status,
      trustScore: user.trustScore
    };
  }

  function demoSession(db, userId) {
    return publicSessionUser(findUser(db, userId));
  }

  function updateDemoProfile(db, { userId, name }) {
    const user = findUser(db, userId);
    const nextName = String(name || "").trim();
    if (!nextName || nextName.length > 12) {
      throw httpError(422, "INVALID_PROFILE_NAME", "닉네임은 1자 이상 12자 이하로 입력해주세요.");
    }
    const previousName = user.name;
    user.name = nextName;
    appendLedger(db, user.id, "DEMO_PROFILE_UPDATED", {
      previousName,
      nextName,
      updatedAt: now(),
      policy: "demo-session-profile-edit"
    });
    return publicSessionUser(user);
  }

  return {
    demoSession,
    updateDemoProfile
  };
}
