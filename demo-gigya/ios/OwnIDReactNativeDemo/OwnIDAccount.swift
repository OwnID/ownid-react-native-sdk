import Gigya

class OwnIDAccount: GigyaAccountProtocol {
    var UID: String?
    var profile: GigyaProfile?
    var UIDSignature: String?
    var apiVersion: Int?
    var created: String?
    var createdTimestamp: Double?
    var isActive: Bool?
    var isRegistered: Bool?
    var isVerified: Bool?
    var lastLogin: String?
    var lastLoginTimestamp: Double?
    var lastUpdated: String?
    var lastUpdatedTimestamp: Double?
    var loginProvider: String?
    var oldestDataUpdated: String?
    var oldestDataUpdatedTimestamp: Double?
    var registered: String?
    var registeredTimestamp: Double?
    var signatureTimestamp: String?
    var socialProviders: String?
    var verified: String?
    var verifiedTimestamp: Double?
    var data: OwnIdKey?
    
    enum CodingKeys: String, CodingKey {
        case UID,
             profile,
             UIDSignature,
             data
    }
    
    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        self.UID = try? container.decodeIfPresent(String.self, forKey: .UID)
        self.profile = try? container.decodeIfPresent(GigyaProfile.self, forKey: .profile)
        self.UIDSignature = try? container.decodeIfPresent(String.self, forKey: .UIDSignature)
        self.data = try? container.decodeIfPresent(OwnIdKey.self, forKey: .data)
    }
}

struct OwnIdKey: Codable {
    let ownId: OwnIDData
}

struct OwnIDData: Codable {
    let connections: [Connection]
}

struct Connection: Codable {
    let authType: String
}

enum GigyaShared {
    static var instance: GigyaCore<OwnIDAccount> {
        Gigya.sharedInstance(OwnIDAccount.self)
    }
}
