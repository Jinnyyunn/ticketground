import SwiftUI

struct ContentView: View {
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Ticketground")
                    .font(.largeTitle.weight(.bold))
                Text("공연을 발견하고, 예매하고, 안전하게 관리하세요.")
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(24)
            .navigationTitle("홈")
            .accessibilityIdentifier("screen-ready-home")
        }
    }
}

#Preview {
    ContentView()
}
