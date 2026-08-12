package kr.ticketground.app.data

import java.time.Instant

object LifecyclePolicy {
  fun canCancel(ticket: OwnedTicket): Boolean = actionableOwned(ticket)
  fun canListForResale(ticket: OwnedTicket, price: Int): Boolean =
    actionableOwned(ticket) && price in ticket.minPrice..ticket.maxPrice
  fun canIssueQr(ticket: OwnedTicket): Boolean = actionableOwned(ticket)
  fun canRevoke(status: TrustedDeviceStatus): Boolean = status == TrustedDeviceStatus.TRUSTED
  fun isPushActive(status: PushTokenStatus): Boolean = status == PushTokenStatus.ACTIVE
  fun isAdmissionQrActionable(expiresAt: String, now: Instant): Boolean =
    runCatching { Instant.parse(expiresAt).isAfter(now) }.getOrDefault(false)
  private fun actionableOwned(ticket: OwnedTicket): Boolean = ticket.status == "OWNED" && !ticket.available
}
