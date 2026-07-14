import Foundation

enum VirtualFixtureDateParser {
    private static let formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let basicFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func parse(_ value: String) throws -> Date {
        if let date = formatter.date(from: value) ?? basicFormatter.date(from: value) {
            return date
        }
        throw VirtualFixtureDecodeError.invalidResponse
    }

    static func parseOptional(_ value: String?) throws -> Date? {
        guard let value else { return nil }
        return try parse(value)
    }
}

enum VirtualMoneyDecoder {
    static func decodeKRW(_ amount: Int) throws -> VirtualMoney {
        guard amount >= 0 else { throw VirtualFixtureDecodeError.invalidResponse }
        return VirtualMoney(amountKRW: amount)
    }
}

enum VirtualFixtureMapper {
    static func state(_ dto: StateDTO) throws -> VirtualState {
        VirtualState(
            source: .bundled,
            events: try dto.events.map(event),
            venues: dto.venues.map(venue),
            users: dto.users.map(user),
            tickets: try dto.tickets.map(ticket),
            resalePools: dto.resalePools.count,
            backendSummary: VirtualBackendSummary(events: dto.backendSummary.events, tickets: dto.backendSummary.tickets),
            ledger: VirtualLedger(verified: dto.ledger.verified, totalEntries: dto.ledger.totalEntries)
        )
    }

    static func seatMap(_ dto: SeatMapDTO) throws -> VirtualSeatMap {
        VirtualSeatMap(
            source: .bundled,
            event: eventSummary(dto.event),
            mapType: dto.map.type,
            imageURL: dto.map.imageUrl,
            zones: dto.zones.map { zone in
                VirtualZone(
                    id: zone.id,
                    name: zone.name,
                    priceKRW: zone.price,
                    seats: zone.seats.map { seat in
                        VirtualSeat(
                            id: seat.id,
                            label: seat.label,
                            status: SeatStatus(rawValue: seat.status),
                            holderId: seat.holderId,
                            priceKRW: zone.price
                        )
                    }
                )
            }
        )
    }

    static func session(_ dto: SessionDTO) -> VirtualSession {
        VirtualSession(source: .bundled, user: dto.user.map(user), authenticated: dto.authenticated, sessionSource: dto.source)
    }

    static func ticket(_ dto: TicketDTO) throws -> VirtualTicket {
        let virtualQR: VirtualQRSummary?
        if let dtoQR = dto.virtualQr {
            virtualQR = VirtualQRSummary(
                type: dtoQR.type,
                issuedAt: try VirtualFixtureDateParser.parse(dtoQR.issuedAt)
            )
        } else {
            virtualQR = nil
        }
        return VirtualTicket(
            id: dto.id,
            eventId: dto.eventId,
            performanceDateId: dto.performanceDateId,
            zoneId: dto.zoneId,
            seatLabel: dto.seatLabel,
            status: TicketStatus(rawValue: dto.status),
            available: dto.available,
            faceValue: try VirtualMoneyDecoder.decodeKRW(dto.faceValue),
            minPrice: try VirtualMoneyDecoder.decodeKRW(dto.minPrice),
            maxPrice: try VirtualMoneyDecoder.decodeKRW(dto.maxPrice),
            transferCount: dto.transferCount,
            maxTransferCount: dto.maxTransferCount,
            issuedAt: try VirtualFixtureDateParser.parseOptional(dto.issuedAt),
            virtualQR: virtualQR
        )
    }

    static func purchase(_ dto: PurchaseDTO) throws -> VirtualPurchase {
        VirtualPurchase(
            source: .bundled,
            ticket: try ticket(dto.ticket),
            event: eventSummary(dto.event),
            performanceDate: try VirtualFixtureDateParser.parse(dto.performanceDate),
            payment: VirtualPayment(method: dto.payment.method, label: dto.payment.label, status: PaymentStatus(rawValue: dto.payment.status)),
            admission: VirtualAdmission(
                status: dto.admission.status,
                preparedAt: try VirtualFixtureDateParser.parse(dto.admission.preparedAt),
                activeAt: try VirtualFixtureDateParser.parseOptional(dto.admission.activeAt),
                activationChannel: dto.admission.activationChannel,
                riskStatus: dto.admission.riskStatus
            )
        )
    }

    static func virtualQR(_ dto: VirtualQRDTO) throws -> VirtualQR {
        VirtualQR(
            source: .bundled,
            ticketId: dto.ticketId,
            type: dto.type,
            issuedAt: try VirtualFixtureDateParser.parse(dto.issuedAt),
            expiresAt: try VirtualFixtureDateParser.parse(dto.expiresAt),
            status: VirtualQRStatus(rawValue: dto.status)
        )
    }

    private static func event(_ dto: EventDTO) throws -> VirtualEvent {
        VirtualEvent(
            id: dto.id,
            title: dto.title,
            category: dto.category,
            venueId: dto.venueId,
            startsAt: try VirtualFixtureDateParser.parse(dto.startsAt),
            saleStatus: SaleStatus(rawValue: dto.sale.status),
            available: dto.sale.available
        )
    }

    private static func venue(_ dto: VenueDTO) -> VirtualVenue {
        VirtualVenue(id: dto.id, name: dto.name, address: dto.address, mapType: dto.mapType, imageURL: dto.imageUrl)
    }

    private static func user(_ dto: UserDTO) -> VirtualUser {
        VirtualUser(id: dto.id, name: dto.name)
    }

    private static func eventSummary(_ dto: EventSummaryDTO) -> VirtualEventSummary {
        VirtualEventSummary(id: dto.id, title: dto.title, venue: dto.venue)
    }
}
