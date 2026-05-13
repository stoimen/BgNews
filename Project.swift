import ProjectDescription

let project = Project(
    name: "NewsAggregator",
    targets: [
        .target(
            name: "NewsAggregator",
            destinations: .iOS,
            product: .app,
            bundleId: "com.bulgarian.newsaggregator",
            deploymentTargets: .iOS("17.0"),
            infoPlist: .extendingDefault(with: [
                "NSAppTransportSecurity": [
                    "NSAllowsArbitraryLoads": true
                ],
                "UILaunchScreen": .dictionary([:])
            ]),
            sources: ["Sources/NewsAggregator/**"],
            dependencies: [
                .external(name: "FeedKit")
            ]
        ),
        .target(
            name: "NewsAggregatorTests",
            destinations: .iOS,
            product: .unitTests,
            bundleId: "com.bulgarian.newsaggregatorTests",
            infoPlist: .default,
            sources: ["Tests/NewsAggregatorTests/**"],
            dependencies: [
                .target(name: "NewsAggregator")
            ]
        )
    ]
)
