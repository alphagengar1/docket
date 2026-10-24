// Real CRS sandbox test personas P01..P20, extracted from the CRS Postman collection
// (folder "Test personas"). All names, SSNs, addresses and phones here are CRS's own
// sandbox test data (CRS states they are fictional test subjects); do not add more.
// requests.* are ready-to-send request bodies per product.
export type CrsLabel = "APPROVE" | "REVIEW" | "DECLINE" | "NO_FILE";
export type CrsPersona = {
  displayName: string;
  /** Label from the CRS collection folder name. */
  label: CrsLabel;
  /** Descriptor from the CRS collection folder name. */
  about: string;
  requests: {
    tu: Record<string, any>;
    efx: Record<string, any>;
    exp: Record<string, any>;
    identity: Record<string, any>;
    fraud: Record<string, any>;
    blj: Record<string, any>;
    criminal: Record<string, any>;
    eviction: Record<string, any>;
  };
};

export const CRS_PERSONAS: Record<string, CrsPersona> = {
  "P01": {
    "displayName": "Margaret Okafor",
    "label": "APPROVE",
    "about": "Prime",
    "requests": {
      "tu": {
        "firstName": "MARGARET",
        "lastName": "OKAFOR",
        "ssn": "666701001",
        "addresses": [
          {
            "addressLine1": "1420 WILLOW CREEK DR",
            "city": "SAN JOSE",
            "state": "CA",
            "postalCode": "95125",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "MARGARET",
        "lastName": "OKAFOR",
        "ssn": "666701001",
        "addresses": [
          {
            "addressLine1": "1420 WILLOW CREEK DR",
            "city": "SAN JOSE",
            "state": "CA",
            "postalCode": "95125",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "MARGARET",
        "lastName": "OKAFOR",
        "ssn": "666701001",
        "addresses": [
          {
            "addressLine1": "1420 WILLOW CREEK DR",
            "city": "SAN JOSE",
            "state": "CA",
            "postalCode": "95125",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "MARGARET",
        "lastName": "OKAFOR",
        "ssn": "666701001",
        "dob": "1984-03-14",
        "street1": "1420 WILLOW CREEK DR",
        "city": "SAN JOSE",
        "state": "CA",
        "zip": "95125"
      },
      "fraud": {
        "firstName": "MARGARET",
        "lastName": "OKAFOR",
        "phoneNumber": "5550101001",
        "email": "margaret.okafor@example.com",
        "ipAddress": "203.0.113.11",
        "address": {
          "addressLine1": "1420 WILLOW CREEK DR",
          "city": "SAN JOSE",
          "state": "CA",
          "postalCode": "95125"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "MARGARET",
                "lastName": "OKAFOR",
                "ssn": "666701001"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "MARGARET",
          "last": "OKAFOR",
          "ssn": "666-70-1001",
          "dob": "03-14-1984",
          "zip": "95125"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "MARGARET",
          "last": "OKAFOR",
          "ssn": "666-70-1001",
          "dob": "03-14-1984",
          "zip": "95125"
        }
      }
    }
  },
  "P02": {
    "displayName": "Daniel Whitfield",
    "label": "APPROVE",
    "about": "Super-prime mortgage holder",
    "requests": {
      "tu": {
        "firstName": "DANIEL",
        "lastName": "WHITFIELD",
        "ssn": "666701002",
        "addresses": [
          {
            "addressLine1": "88 LAKESHORE BLVD",
            "city": "AUSTIN",
            "state": "TX",
            "postalCode": "78746",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "DANIEL",
        "lastName": "WHITFIELD",
        "ssn": "666701002",
        "addresses": [
          {
            "addressLine1": "88 LAKESHORE BLVD",
            "city": "AUSTIN",
            "state": "TX",
            "postalCode": "78746",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "DANIEL",
        "lastName": "WHITFIELD",
        "ssn": "666701002",
        "addresses": [
          {
            "addressLine1": "88 LAKESHORE BLVD",
            "city": "AUSTIN",
            "state": "TX",
            "postalCode": "78746",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "DANIEL",
        "lastName": "WHITFIELD",
        "ssn": "666701002",
        "dob": "1972-11-02",
        "street1": "88 LAKESHORE BLVD",
        "city": "AUSTIN",
        "state": "TX",
        "zip": "78746"
      },
      "fraud": {
        "firstName": "DANIEL",
        "lastName": "WHITFIELD",
        "phoneNumber": "5550101002",
        "email": "daniel.whitfield@example.com",
        "ipAddress": "203.0.113.12",
        "address": {
          "addressLine1": "88 LAKESHORE BLVD",
          "city": "AUSTIN",
          "state": "TX",
          "postalCode": "78746"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "DANIEL",
                "lastName": "WHITFIELD",
                "ssn": "666701002"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "DANIEL",
          "last": "WHITFIELD",
          "ssn": "666-70-1002",
          "dob": "11-02-1972",
          "zip": "78746"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "DANIEL",
          "last": "WHITFIELD",
          "ssn": "666-70-1002",
          "dob": "11-02-1972",
          "zip": "78746"
        }
      }
    }
  },
  "P03": {
    "displayName": "Jasmine Reyes",
    "label": "REVIEW",
    "about": "Thin file / Gen Z",
    "requests": {
      "tu": {
        "firstName": "JASMINE",
        "lastName": "REYES",
        "ssn": "666701003",
        "addresses": [
          {
            "addressLine1": "2210 UNIVERSITY AVE APT 4B",
            "city": "BERKELEY",
            "state": "CA",
            "postalCode": "94704",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "JASMINE",
        "lastName": "REYES",
        "ssn": "666701003",
        "addresses": [
          {
            "addressLine1": "2210 UNIVERSITY AVE APT 4B",
            "city": "BERKELEY",
            "state": "CA",
            "postalCode": "94704",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "JASMINE",
        "lastName": "REYES",
        "ssn": "666701003",
        "addresses": [
          {
            "addressLine1": "2210 UNIVERSITY AVE APT 4B",
            "city": "BERKELEY",
            "state": "CA",
            "postalCode": "94704",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "JASMINE",
        "lastName": "REYES",
        "ssn": "666701003",
        "dob": "2004-06-21",
        "street1": "2210 UNIVERSITY AVE APT 4B",
        "city": "BERKELEY",
        "state": "CA",
        "zip": "94704"
      },
      "fraud": {
        "firstName": "JASMINE",
        "lastName": "REYES",
        "phoneNumber": "5550101003",
        "email": "jasmine.reyes@example.com",
        "ipAddress": "203.0.113.13",
        "address": {
          "addressLine1": "2210 UNIVERSITY AVE APT 4B",
          "city": "BERKELEY",
          "state": "CA",
          "postalCode": "94704"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "JASMINE",
                "lastName": "REYES",
                "ssn": "666701003"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "JASMINE",
          "last": "REYES",
          "ssn": "666-70-1003",
          "dob": "06-21-2004",
          "zip": "94704"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "JASMINE",
          "last": "REYES",
          "ssn": "666-70-1003",
          "dob": "06-21-2004",
          "zip": "94704"
        }
      }
    }
  },
  "P04": {
    "displayName": "Tomas Lindqvist",
    "label": "NO_FILE",
    "about": "Credit invisible",
    "requests": {
      "tu": {
        "firstName": "TOMAS",
        "lastName": "LINDQVIST",
        "ssn": "666701004",
        "addresses": [
          {
            "addressLine1": "415 PINE ST UNIT 12",
            "city": "SEATTLE",
            "state": "WA",
            "postalCode": "98101",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "TOMAS",
        "lastName": "LINDQVIST",
        "ssn": "666701004",
        "addresses": [
          {
            "addressLine1": "415 PINE ST UNIT 12",
            "city": "SEATTLE",
            "state": "WA",
            "postalCode": "98101",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "TOMAS",
        "lastName": "LINDQVIST",
        "ssn": "666701004",
        "addresses": [
          {
            "addressLine1": "415 PINE ST UNIT 12",
            "city": "SEATTLE",
            "state": "WA",
            "postalCode": "98101",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "TOMAS",
        "lastName": "LINDQVIST",
        "ssn": "666701004",
        "dob": "1990-01-30",
        "street1": "415 PINE ST UNIT 12",
        "city": "SEATTLE",
        "state": "WA",
        "zip": "98101"
      },
      "fraud": {
        "firstName": "TOMAS",
        "lastName": "LINDQVIST",
        "phoneNumber": "5550101004",
        "email": "tomas.lindqvist@example.com",
        "ipAddress": "203.0.113.14",
        "address": {
          "addressLine1": "415 PINE ST UNIT 12",
          "city": "SEATTLE",
          "state": "WA",
          "postalCode": "98101"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "TOMAS",
                "lastName": "LINDQVIST",
                "ssn": "666701004"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "TOMAS",
          "last": "LINDQVIST",
          "ssn": "666-70-1004",
          "dob": "01-30-1990",
          "zip": "98101"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "TOMAS",
          "last": "LINDQVIST",
          "ssn": "666-70-1004",
          "dob": "01-30-1990",
          "zip": "98101"
        }
      }
    }
  },
  "P05": {
    "displayName": "Ricky Dalton",
    "label": "DECLINE",
    "about": "Subprime",
    "requests": {
      "tu": {
        "firstName": "RICKY",
        "lastName": "DALTON",
        "ssn": "666701005",
        "addresses": [
          {
            "addressLine1": "7031 SUNSET RIDGE RD",
            "city": "ORLANDO",
            "state": "FL",
            "postalCode": "32819",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "RICKY",
        "lastName": "DALTON",
        "ssn": "666701005",
        "addresses": [
          {
            "addressLine1": "7031 SUNSET RIDGE RD",
            "city": "ORLANDO",
            "state": "FL",
            "postalCode": "32819",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "RICKY",
        "lastName": "DALTON",
        "ssn": "666701005",
        "addresses": [
          {
            "addressLine1": "7031 SUNSET RIDGE RD",
            "city": "ORLANDO",
            "state": "FL",
            "postalCode": "32819",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "RICKY",
        "lastName": "DALTON",
        "ssn": "666701005",
        "dob": "1988-09-09",
        "street1": "7031 SUNSET RIDGE RD",
        "city": "ORLANDO",
        "state": "FL",
        "zip": "32819"
      },
      "fraud": {
        "firstName": "RICKY",
        "lastName": "DALTON",
        "phoneNumber": "5550101005",
        "email": "ricky.dalton@example.com",
        "ipAddress": "203.0.113.15",
        "address": {
          "addressLine1": "7031 SUNSET RIDGE RD",
          "city": "ORLANDO",
          "state": "FL",
          "postalCode": "32819"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "RICKY",
                "lastName": "DALTON",
                "ssn": "666701005"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "RICKY",
          "last": "DALTON",
          "ssn": "666-70-1005",
          "dob": "09-09-1988",
          "zip": "32819"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "RICKY",
          "last": "DALTON",
          "ssn": "666-70-1005",
          "dob": "09-09-1988",
          "zip": "32819"
        }
      }
    }
  },
  "P06": {
    "displayName": "Angela Morrissey",
    "label": "REVIEW",
    "about": "Chapter 7 discharged",
    "requests": {
      "tu": {
        "firstName": "ANGELA",
        "lastName": "MORRISSEY",
        "ssn": "666701006",
        "addresses": [
          {
            "addressLine1": "960 MAPLEWOOD AVE",
            "city": "COLUMBUS",
            "state": "OH",
            "postalCode": "43209",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "ANGELA",
        "lastName": "MORRISSEY",
        "ssn": "666701006",
        "addresses": [
          {
            "addressLine1": "960 MAPLEWOOD AVE",
            "city": "COLUMBUS",
            "state": "OH",
            "postalCode": "43209",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "ANGELA",
        "lastName": "MORRISSEY",
        "ssn": "666701006",
        "addresses": [
          {
            "addressLine1": "960 MAPLEWOOD AVE",
            "city": "COLUMBUS",
            "state": "OH",
            "postalCode": "43209",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "ANGELA",
        "lastName": "MORRISSEY",
        "ssn": "666701006",
        "dob": "1979-04-18",
        "street1": "960 MAPLEWOOD AVE",
        "city": "COLUMBUS",
        "state": "OH",
        "zip": "43209"
      },
      "fraud": {
        "firstName": "ANGELA",
        "lastName": "MORRISSEY",
        "phoneNumber": "5550101006",
        "email": "angela.morrissey@example.com",
        "ipAddress": "203.0.113.16",
        "address": {
          "addressLine1": "960 MAPLEWOOD AVE",
          "city": "COLUMBUS",
          "state": "OH",
          "postalCode": "43209"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "ANGELA",
                "lastName": "MORRISSEY",
                "ssn": "666701006"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "ANGELA",
          "last": "MORRISSEY",
          "ssn": "666-70-1006",
          "dob": "04-18-1979",
          "zip": "43209"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "ANGELA",
          "last": "MORRISSEY",
          "ssn": "666-70-1006",
          "dob": "04-18-1979",
          "zip": "43209"
        }
      }
    }
  },
  "P07": {
    "displayName": "Marcus Bellamy",
    "label": "DECLINE",
    "about": "Chapter 13 active",
    "requests": {
      "tu": {
        "firstName": "MARCUS",
        "lastName": "BELLAMY",
        "ssn": "666701007",
        "addresses": [
          {
            "addressLine1": "1507 PEACHTREE INDUSTRIAL BLVD",
            "city": "ATLANTA",
            "state": "GA",
            "postalCode": "30341",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "MARCUS",
        "lastName": "BELLAMY",
        "ssn": "666701007",
        "addresses": [
          {
            "addressLine1": "1507 PEACHTREE INDUSTRIAL BLVD",
            "city": "ATLANTA",
            "state": "GA",
            "postalCode": "30341",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "MARCUS",
        "lastName": "BELLAMY",
        "ssn": "666701007",
        "addresses": [
          {
            "addressLine1": "1507 PEACHTREE INDUSTRIAL BLVD",
            "city": "ATLANTA",
            "state": "GA",
            "postalCode": "30341",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "MARCUS",
        "lastName": "BELLAMY",
        "ssn": "666701007",
        "dob": "1975-12-05",
        "street1": "1507 PEACHTREE INDUSTRIAL BLVD",
        "city": "ATLANTA",
        "state": "GA",
        "zip": "30341"
      },
      "fraud": {
        "firstName": "MARCUS",
        "lastName": "BELLAMY",
        "phoneNumber": "5550101007",
        "email": "marcus.bellamy@example.com",
        "ipAddress": "203.0.113.17",
        "address": {
          "addressLine1": "1507 PEACHTREE INDUSTRIAL BLVD",
          "city": "ATLANTA",
          "state": "GA",
          "postalCode": "30341"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "MARCUS",
                "lastName": "BELLAMY",
                "ssn": "666701007"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "MARCUS",
          "last": "BELLAMY",
          "ssn": "666-70-1007",
          "dob": "12-05-1975",
          "zip": "30341"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "MARCUS",
          "last": "BELLAMY",
          "ssn": "666-70-1007",
          "dob": "12-05-1975",
          "zip": "30341"
        }
      }
    }
  },
  "P08": {
    "displayName": "Priya Venkatesan",
    "label": "REVIEW",
    "about": "Tax lien and civil judgment",
    "requests": {
      "tu": {
        "firstName": "PRIYA",
        "lastName": "VENKATESAN",
        "ssn": "666701008",
        "addresses": [
          {
            "addressLine1": "3300 N LAKE SHORE DR APT 15C",
            "city": "CHICAGO",
            "state": "IL",
            "postalCode": "60657",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "PRIYA",
        "lastName": "VENKATESAN",
        "ssn": "666701008",
        "addresses": [
          {
            "addressLine1": "3300 N LAKE SHORE DR APT 15C",
            "city": "CHICAGO",
            "state": "IL",
            "postalCode": "60657",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "PRIYA",
        "lastName": "VENKATESAN",
        "ssn": "666701008",
        "addresses": [
          {
            "addressLine1": "3300 N LAKE SHORE DR APT 15C",
            "city": "CHICAGO",
            "state": "IL",
            "postalCode": "60657",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "PRIYA",
        "lastName": "VENKATESAN",
        "ssn": "666701008",
        "dob": "1981-07-27",
        "street1": "3300 N LAKE SHORE DR APT 15C",
        "city": "CHICAGO",
        "state": "IL",
        "zip": "60657"
      },
      "fraud": {
        "firstName": "PRIYA",
        "lastName": "VENKATESAN",
        "phoneNumber": "5550101008",
        "email": "priya.venkatesan@example.com",
        "ipAddress": "203.0.113.18",
        "address": {
          "addressLine1": "3300 N LAKE SHORE DR APT 15C",
          "city": "CHICAGO",
          "state": "IL",
          "postalCode": "60657"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "PRIYA",
                "lastName": "VENKATESAN",
                "ssn": "666701008"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "PRIYA",
          "last": "VENKATESAN",
          "ssn": "666-70-1008",
          "dob": "07-27-1981",
          "zip": "60657"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "PRIYA",
          "last": "VENKATESAN",
          "ssn": "666-70-1008",
          "dob": "07-27-1981",
          "zip": "60657"
        }
      }
    }
  },
  "P09": {
    "displayName": "Derek Holloway",
    "label": "DECLINE",
    "about": "Felony conviction",
    "requests": {
      "tu": {
        "firstName": "DEREK",
        "lastName": "HOLLOWAY",
        "ssn": "666701009",
        "addresses": [
          {
            "addressLine1": "4875 W COLFAX AVE",
            "city": "DENVER",
            "state": "CO",
            "postalCode": "80204",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "DEREK",
        "lastName": "HOLLOWAY",
        "ssn": "666701009",
        "addresses": [
          {
            "addressLine1": "4875 W COLFAX AVE",
            "city": "DENVER",
            "state": "CO",
            "postalCode": "80204",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "DEREK",
        "lastName": "HOLLOWAY",
        "ssn": "666701009",
        "addresses": [
          {
            "addressLine1": "4875 W COLFAX AVE",
            "city": "DENVER",
            "state": "CO",
            "postalCode": "80204",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "DEREK",
        "lastName": "HOLLOWAY",
        "ssn": "666701009",
        "dob": "1986-02-11",
        "street1": "4875 W COLFAX AVE",
        "city": "DENVER",
        "state": "CO",
        "zip": "80204"
      },
      "fraud": {
        "firstName": "DEREK",
        "lastName": "HOLLOWAY",
        "phoneNumber": "5550101009",
        "email": "derek.holloway@example.com",
        "ipAddress": "203.0.113.19",
        "address": {
          "addressLine1": "4875 W COLFAX AVE",
          "city": "DENVER",
          "state": "CO",
          "postalCode": "80204"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "DEREK",
                "lastName": "HOLLOWAY",
                "ssn": "666701009"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "DEREK",
          "last": "HOLLOWAY",
          "ssn": "666-70-1009",
          "dob": "02-11-1986",
          "zip": "80204"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "DEREK",
          "last": "HOLLOWAY",
          "ssn": "666-70-1009",
          "dob": "02-11-1986",
          "zip": "80204"
        }
      }
    }
  },
  "P10": {
    "displayName": "Lauren Kowalczyk",
    "label": "APPROVE",
    "about": "Old dismissed misdemeanor",
    "requests": {
      "tu": {
        "firstName": "LAUREN",
        "lastName": "KOWALCZYK",
        "ssn": "666701010",
        "addresses": [
          {
            "addressLine1": "1181 WOODWARD AVE",
            "city": "DETROIT",
            "state": "MI",
            "postalCode": "48226",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "LAUREN",
        "lastName": "KOWALCZYK",
        "ssn": "666701010",
        "addresses": [
          {
            "addressLine1": "1181 WOODWARD AVE",
            "city": "DETROIT",
            "state": "MI",
            "postalCode": "48226",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "LAUREN",
        "lastName": "KOWALCZYK",
        "ssn": "666701010",
        "addresses": [
          {
            "addressLine1": "1181 WOODWARD AVE",
            "city": "DETROIT",
            "state": "MI",
            "postalCode": "48226",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "LAUREN",
        "lastName": "KOWALCZYK",
        "ssn": "666701010",
        "dob": "1992-10-03",
        "street1": "1181 WOODWARD AVE",
        "city": "DETROIT",
        "state": "MI",
        "zip": "48226"
      },
      "fraud": {
        "firstName": "LAUREN",
        "lastName": "KOWALCZYK",
        "phoneNumber": "5550101010",
        "email": "lauren.kowalczyk@example.com",
        "ipAddress": "203.0.113.20",
        "address": {
          "addressLine1": "1181 WOODWARD AVE",
          "city": "DETROIT",
          "state": "MI",
          "postalCode": "48226"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "LAUREN",
                "lastName": "KOWALCZYK",
                "ssn": "666701010"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "LAUREN",
          "last": "KOWALCZYK",
          "ssn": "666-70-1010",
          "dob": "10-03-1992",
          "zip": "48226"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "LAUREN",
          "last": "KOWALCZYK",
          "ssn": "666-70-1010",
          "dob": "10-03-1992",
          "zip": "48226"
        }
      }
    }
  },
  "P11": {
    "displayName": "Brandon Szabo",
    "label": "DECLINE",
    "about": "Eviction history",
    "requests": {
      "tu": {
        "firstName": "BRANDON",
        "lastName": "SZABO",
        "ssn": "666701011",
        "addresses": [
          {
            "addressLine1": "2640 HIGHLAND AVE APT 7",
            "city": "NATIONAL CITY",
            "state": "CA",
            "postalCode": "91950",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "BRANDON",
        "lastName": "SZABO",
        "ssn": "666701011",
        "addresses": [
          {
            "addressLine1": "2640 HIGHLAND AVE APT 7",
            "city": "NATIONAL CITY",
            "state": "CA",
            "postalCode": "91950",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "BRANDON",
        "lastName": "SZABO",
        "ssn": "666701011",
        "addresses": [
          {
            "addressLine1": "2640 HIGHLAND AVE APT 7",
            "city": "NATIONAL CITY",
            "state": "CA",
            "postalCode": "91950",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "BRANDON",
        "lastName": "SZABO",
        "ssn": "666701011",
        "dob": "1995-05-15",
        "street1": "2640 HIGHLAND AVE APT 7",
        "city": "NATIONAL CITY",
        "state": "CA",
        "zip": "91950"
      },
      "fraud": {
        "firstName": "BRANDON",
        "lastName": "SZABO",
        "phoneNumber": "5550101011",
        "email": "brandon.szabo@example.com",
        "ipAddress": "203.0.113.21",
        "address": {
          "addressLine1": "2640 HIGHLAND AVE APT 7",
          "city": "NATIONAL CITY",
          "state": "CA",
          "postalCode": "91950"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "BRANDON",
                "lastName": "SZABO",
                "ssn": "666701011"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "BRANDON",
          "last": "SZABO",
          "ssn": "666-70-1011",
          "dob": "05-15-1995",
          "zip": "91950"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "BRANDON",
          "last": "SZABO",
          "ssn": "666-70-1011",
          "dob": "05-15-1995",
          "zip": "91950"
        }
      }
    }
  },
  "P12": {
    "displayName": "Victor Anand",
    "label": "DECLINE",
    "about": "Identity mismatch",
    "requests": {
      "tu": {
        "firstName": "VICTOR",
        "lastName": "ANAND",
        "ssn": "666701012",
        "addresses": [
          {
            "addressLine1": "55 WATER ST FL 20",
            "city": "NEW YORK",
            "state": "NY",
            "postalCode": "10041",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "VICTOR",
        "lastName": "ANAND",
        "ssn": "666701012",
        "addresses": [
          {
            "addressLine1": "55 WATER ST FL 20",
            "city": "NEW YORK",
            "state": "NY",
            "postalCode": "10041",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "VICTOR",
        "lastName": "ANAND",
        "ssn": "666701012",
        "addresses": [
          {
            "addressLine1": "55 WATER ST FL 20",
            "city": "NEW YORK",
            "state": "NY",
            "postalCode": "10041",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "VICTOR",
        "lastName": "ANAND",
        "ssn": "666701012",
        "dob": "1968-08-08",
        "street1": "55 WATER ST FL 20",
        "city": "NEW YORK",
        "state": "NY",
        "zip": "10041"
      },
      "fraud": {
        "firstName": "VICTOR",
        "lastName": "ANAND",
        "phoneNumber": "5550101012",
        "email": "v.anand.1968@example.com",
        "ipAddress": "198.51.100.12",
        "address": {
          "addressLine1": "55 WATER ST FL 20",
          "city": "NEW YORK",
          "state": "NY",
          "postalCode": "10041"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "VICTOR",
                "lastName": "ANAND",
                "ssn": "666701012"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "VICTOR",
          "last": "ANAND",
          "ssn": "666-70-1012",
          "dob": "08-08-1968",
          "zip": "10041"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "VICTOR",
          "last": "ANAND",
          "ssn": "666-70-1012",
          "dob": "08-08-1968",
          "zip": "10041"
        }
      }
    }
  },
  "P13": {
    "displayName": "Kayla Brennan",
    "label": "DECLINE",
    "about": "Synthetic identity / fraud",
    "requests": {
      "tu": {
        "firstName": "KAYLA",
        "lastName": "BRENNAN",
        "ssn": "666701013",
        "addresses": [
          {
            "addressLine1": "9021 KINGSTON PIKE",
            "city": "KNOXVILLE",
            "state": "TN",
            "postalCode": "37923",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "KAYLA",
        "lastName": "BRENNAN",
        "ssn": "666701013",
        "addresses": [
          {
            "addressLine1": "9021 KINGSTON PIKE",
            "city": "KNOXVILLE",
            "state": "TN",
            "postalCode": "37923",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "KAYLA",
        "lastName": "BRENNAN",
        "ssn": "666701013",
        "addresses": [
          {
            "addressLine1": "9021 KINGSTON PIKE",
            "city": "KNOXVILLE",
            "state": "TN",
            "postalCode": "37923",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "KAYLA",
        "lastName": "BRENNAN",
        "ssn": "666701013",
        "dob": "1999-12-24",
        "street1": "9021 KINGSTON PIKE",
        "city": "KNOXVILLE",
        "state": "TN",
        "zip": "37923"
      },
      "fraud": {
        "firstName": "KAYLA",
        "lastName": "BRENNAN",
        "phoneNumber": "5550101013",
        "email": "kb.9921x@example.com",
        "ipAddress": "198.51.100.13",
        "address": {
          "addressLine1": "9021 KINGSTON PIKE",
          "city": "KNOXVILLE",
          "state": "TN",
          "postalCode": "37923"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "KAYLA",
                "lastName": "BRENNAN",
                "ssn": "666701013"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "KAYLA",
          "last": "BRENNAN",
          "ssn": "666-70-1013",
          "dob": "12-24-1999",
          "zip": "37923"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "KAYLA",
          "last": "BRENNAN",
          "ssn": "666-70-1013",
          "dob": "12-24-1999",
          "zip": "37923"
        }
      }
    }
  },
  "P14": {
    "displayName": "Harold Pettigrew",
    "label": "DECLINE",
    "about": "Deceased indicator",
    "requests": {
      "tu": {
        "firstName": "HAROLD",
        "lastName": "PETTIGREW",
        "ssn": "666701014",
        "addresses": [
          {
            "addressLine1": "310 ELM ST",
            "city": "DAYTON",
            "state": "OH",
            "postalCode": "45402",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "HAROLD",
        "lastName": "PETTIGREW",
        "ssn": "666701014",
        "addresses": [
          {
            "addressLine1": "310 ELM ST",
            "city": "DAYTON",
            "state": "OH",
            "postalCode": "45402",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "HAROLD",
        "lastName": "PETTIGREW",
        "ssn": "666701014",
        "addresses": [
          {
            "addressLine1": "310 ELM ST",
            "city": "DAYTON",
            "state": "OH",
            "postalCode": "45402",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "HAROLD",
        "lastName": "PETTIGREW",
        "ssn": "666701014",
        "dob": "1948-01-19",
        "street1": "310 ELM ST",
        "city": "DAYTON",
        "state": "OH",
        "zip": "45402"
      },
      "fraud": {
        "firstName": "HAROLD",
        "lastName": "PETTIGREW",
        "phoneNumber": "5550101014",
        "email": "harold.pettigrew@example.com",
        "ipAddress": "203.0.113.24",
        "address": {
          "addressLine1": "310 ELM ST",
          "city": "DAYTON",
          "state": "OH",
          "postalCode": "45402"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "HAROLD",
                "lastName": "PETTIGREW",
                "ssn": "666701014"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "HAROLD",
          "last": "PETTIGREW",
          "ssn": "666-70-1014",
          "dob": "01-19-1948",
          "zip": "45402"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "HAROLD",
          "last": "PETTIGREW",
          "ssn": "666-70-1014",
          "dob": "01-19-1948",
          "zip": "45402"
        }
      }
    }
  },
  "P15": {
    "displayName": "Nicole Farragut",
    "label": "REVIEW",
    "about": "Security freeze at one bureau",
    "requests": {
      "tu": {
        "firstName": "NICOLE",
        "lastName": "FARRAGUT",
        "ssn": "666701015",
        "addresses": [
          {
            "addressLine1": "7700 NE 72ND AVE",
            "city": "PORTLAND",
            "state": "OR",
            "postalCode": "97218",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "NICOLE",
        "lastName": "FARRAGUT",
        "ssn": "666701015",
        "addresses": [
          {
            "addressLine1": "7700 NE 72ND AVE",
            "city": "PORTLAND",
            "state": "OR",
            "postalCode": "97218",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "NICOLE",
        "lastName": "FARRAGUT",
        "ssn": "666701015",
        "addresses": [
          {
            "addressLine1": "7700 NE 72ND AVE",
            "city": "PORTLAND",
            "state": "OR",
            "postalCode": "97218",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "NICOLE",
        "lastName": "FARRAGUT",
        "ssn": "666701015",
        "dob": "1983-03-30",
        "street1": "7700 NE 72ND AVE",
        "city": "PORTLAND",
        "state": "OR",
        "zip": "97218"
      },
      "fraud": {
        "firstName": "NICOLE",
        "lastName": "FARRAGUT",
        "phoneNumber": "5550101015",
        "email": "nicole.farragut@example.com",
        "ipAddress": "203.0.113.25",
        "address": {
          "addressLine1": "7700 NE 72ND AVE",
          "city": "PORTLAND",
          "state": "OR",
          "postalCode": "97218"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "NICOLE",
                "lastName": "FARRAGUT",
                "ssn": "666701015"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "NICOLE",
          "last": "FARRAGUT",
          "ssn": "666-70-1015",
          "dob": "03-30-1983",
          "zip": "97218"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "NICOLE",
          "last": "FARRAGUT",
          "ssn": "666-70-1015",
          "dob": "03-30-1983",
          "zip": "97218"
        }
      }
    }
  },
  "P16": {
    "displayName": "Samuel Oyelaran",
    "label": "REVIEW",
    "about": "Fraud alert on file",
    "requests": {
      "tu": {
        "firstName": "SAMUEL",
        "lastName": "OYELARAN",
        "ssn": "666701016",
        "addresses": [
          {
            "addressLine1": "1200 BRICKELL BAY DR APT 2203",
            "city": "MIAMI",
            "state": "FL",
            "postalCode": "33131",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "SAMUEL",
        "lastName": "OYELARAN",
        "ssn": "666701016",
        "addresses": [
          {
            "addressLine1": "1200 BRICKELL BAY DR APT 2203",
            "city": "MIAMI",
            "state": "FL",
            "postalCode": "33131",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "SAMUEL",
        "lastName": "OYELARAN",
        "ssn": "666701016",
        "addresses": [
          {
            "addressLine1": "1200 BRICKELL BAY DR APT 2203",
            "city": "MIAMI",
            "state": "FL",
            "postalCode": "33131",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "SAMUEL",
        "lastName": "OYELARAN",
        "ssn": "666701016",
        "dob": "1977-06-12",
        "street1": "1200 BRICKELL BAY DR APT 2203",
        "city": "MIAMI",
        "state": "FL",
        "zip": "33131"
      },
      "fraud": {
        "firstName": "SAMUEL",
        "lastName": "OYELARAN",
        "phoneNumber": "5550101016",
        "email": "samuel.oyelaran@example.com",
        "ipAddress": "203.0.113.26",
        "address": {
          "addressLine1": "1200 BRICKELL BAY DR APT 2203",
          "city": "MIAMI",
          "state": "FL",
          "postalCode": "33131"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "SAMUEL",
                "lastName": "OYELARAN",
                "ssn": "666701016"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "SAMUEL",
          "last": "OYELARAN",
          "ssn": "666-70-1016",
          "dob": "06-12-1977",
          "zip": "33131"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "SAMUEL",
          "last": "OYELARAN",
          "ssn": "666-70-1016",
          "dob": "06-12-1977",
          "zip": "33131"
        }
      }
    }
  },
  "P17": {
    "displayName": "Elena Castellanos",
    "label": "REVIEW",
    "about": "Bureau divergence",
    "requests": {
      "tu": {
        "firstName": "ELENA",
        "lastName": "CASTELLANOS",
        "ssn": "666701017",
        "addresses": [
          {
            "addressLine1": "4400 N CENTRAL EXPY STE 100",
            "city": "DALLAS",
            "state": "TX",
            "postalCode": "75206",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "ELENA",
        "lastName": "CASTELLANOS",
        "ssn": "666701017",
        "addresses": [
          {
            "addressLine1": "4400 N CENTRAL EXPY STE 100",
            "city": "DALLAS",
            "state": "TX",
            "postalCode": "75206",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "ELENA",
        "lastName": "CASTELLANOS",
        "ssn": "666701017",
        "addresses": [
          {
            "addressLine1": "4400 N CENTRAL EXPY STE 100",
            "city": "DALLAS",
            "state": "TX",
            "postalCode": "75206",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "ELENA",
        "lastName": "CASTELLANOS",
        "ssn": "666701017",
        "dob": "1987-11-20",
        "street1": "4400 N CENTRAL EXPY STE 100",
        "city": "DALLAS",
        "state": "TX",
        "zip": "75206"
      },
      "fraud": {
        "firstName": "ELENA",
        "lastName": "CASTELLANOS",
        "phoneNumber": "5550101017",
        "email": "elena.castellanos@example.com",
        "ipAddress": "203.0.113.27",
        "address": {
          "addressLine1": "4400 N CENTRAL EXPY STE 100",
          "city": "DALLAS",
          "state": "TX",
          "postalCode": "75206"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "ELENA",
                "lastName": "CASTELLANOS",
                "ssn": "666701017"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "ELENA",
          "last": "CASTELLANOS",
          "ssn": "666-70-1017",
          "dob": "11-20-1987",
          "zip": "75206"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "ELENA",
          "last": "CASTELLANOS",
          "ssn": "666-70-1017",
          "dob": "11-20-1987",
          "zip": "75206"
        }
      }
    }
  },
  "P18": {
    "displayName": "Terrence Abernathy",
    "label": "REVIEW",
    "about": "Rebuilding",
    "requests": {
      "tu": {
        "firstName": "TERRENCE",
        "lastName": "ABERNATHY",
        "ssn": "666701018",
        "addresses": [
          {
            "addressLine1": "2102 S HALSTED ST",
            "city": "CHICAGO",
            "state": "IL",
            "postalCode": "60608",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "TERRENCE",
        "lastName": "ABERNATHY",
        "ssn": "666701018",
        "addresses": [
          {
            "addressLine1": "2102 S HALSTED ST",
            "city": "CHICAGO",
            "state": "IL",
            "postalCode": "60608",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "TERRENCE",
        "lastName": "ABERNATHY",
        "ssn": "666701018",
        "addresses": [
          {
            "addressLine1": "2102 S HALSTED ST",
            "city": "CHICAGO",
            "state": "IL",
            "postalCode": "60608",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "TERRENCE",
        "lastName": "ABERNATHY",
        "ssn": "666701018",
        "dob": "1980-02-29",
        "street1": "2102 S HALSTED ST",
        "city": "CHICAGO",
        "state": "IL",
        "zip": "60608"
      },
      "fraud": {
        "firstName": "TERRENCE",
        "lastName": "ABERNATHY",
        "phoneNumber": "5550101018",
        "email": "terrence.abernathy@example.com",
        "ipAddress": "203.0.113.28",
        "address": {
          "addressLine1": "2102 S HALSTED ST",
          "city": "CHICAGO",
          "state": "IL",
          "postalCode": "60608"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "TERRENCE",
                "lastName": "ABERNATHY",
                "ssn": "666701018"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "TERRENCE",
          "last": "ABERNATHY",
          "ssn": "666-70-1018",
          "dob": "02-29-1980",
          "zip": "60608"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "TERRENCE",
          "last": "ABERNATHY",
          "ssn": "666-70-1018",
          "dob": "02-29-1980",
          "zip": "60608"
        }
      }
    }
  },
  "P19": {
    "displayName": "Grace Nakamura",
    "label": "APPROVE",
    "about": "Small-business owner",
    "requests": {
      "tu": {
        "firstName": "GRACE",
        "lastName": "NAKAMURA",
        "ssn": "666701019",
        "addresses": [
          {
            "addressLine1": "1850 SOLANO AVE",
            "city": "BERKELEY",
            "state": "CA",
            "postalCode": "94707",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "GRACE",
        "lastName": "NAKAMURA",
        "ssn": "666701019",
        "addresses": [
          {
            "addressLine1": "1850 SOLANO AVE",
            "city": "BERKELEY",
            "state": "CA",
            "postalCode": "94707",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "GRACE",
        "lastName": "NAKAMURA",
        "ssn": "666701019",
        "addresses": [
          {
            "addressLine1": "1850 SOLANO AVE",
            "city": "BERKELEY",
            "state": "CA",
            "postalCode": "94707",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "GRACE",
        "lastName": "NAKAMURA",
        "ssn": "666701019",
        "dob": "1976-09-16",
        "street1": "1850 SOLANO AVE",
        "city": "BERKELEY",
        "state": "CA",
        "zip": "94707"
      },
      "fraud": {
        "firstName": "GRACE",
        "lastName": "NAKAMURA",
        "phoneNumber": "5550101019",
        "email": "grace.nakamura@example.com",
        "ipAddress": "203.0.113.29",
        "address": {
          "addressLine1": "1850 SOLANO AVE",
          "city": "BERKELEY",
          "state": "CA",
          "postalCode": "94707"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "GRACE",
                "lastName": "NAKAMURA",
                "ssn": "666701019"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "GRACE",
          "last": "NAKAMURA",
          "ssn": "666-70-1019",
          "dob": "09-16-1976",
          "zip": "94707"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "GRACE",
          "last": "NAKAMURA",
          "ssn": "666-70-1019",
          "dob": "09-16-1976",
          "zip": "94707"
        }
      }
    }
  },
  "P20": {
    "displayName": "Dolores Whitcomb",
    "label": "REVIEW",
    "about": "Retiree with stale file",
    "requests": {
      "tu": {
        "firstName": "DOLORES",
        "lastName": "WHITCOMB",
        "ssn": "666701020",
        "addresses": [
          {
            "addressLine1": "612 OCEAN VIEW DR",
            "city": "SANTA BARBARA",
            "state": "CA",
            "postalCode": "93109",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "efx": {
        "firstName": "DOLORES",
        "lastName": "WHITCOMB",
        "ssn": "666701020",
        "addresses": [
          {
            "addressLine1": "612 OCEAN VIEW DR",
            "city": "SANTA BARBARA",
            "state": "CA",
            "postalCode": "93109",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "exp": {
        "firstName": "DOLORES",
        "lastName": "WHITCOMB",
        "ssn": "666701020",
        "addresses": [
          {
            "addressLine1": "612 OCEAN VIEW DR",
            "city": "SANTA BARBARA",
            "state": "CA",
            "postalCode": "93109",
            "borrowerResidencyType": "Current"
          }
        ]
      },
      "identity": {
        "firstName": "DOLORES",
        "lastName": "WHITCOMB",
        "ssn": "666701020",
        "dob": "1952-05-04",
        "street1": "612 OCEAN VIEW DR",
        "city": "SANTA BARBARA",
        "state": "CA",
        "zip": "93109"
      },
      "fraud": {
        "firstName": "DOLORES",
        "lastName": "WHITCOMB",
        "phoneNumber": "5550101020",
        "email": "dolores.whitcomb@example.com",
        "ipAddress": "203.0.113.30",
        "address": {
          "addressLine1": "612 OCEAN VIEW DR",
          "city": "SANTA BARBARA",
          "state": "CA",
          "postalCode": "93109"
        }
      },
      "blj": {
        "terms": {
          "term": [
            {
              "person": {
                "firstName": "DOLORES",
                "lastName": "WHITCOMB",
                "ssn": "666701020"
              }
            }
          ]
        }
      },
      "criminal": {
        "subjectInfo": {
          "first": "DOLORES",
          "last": "WHITCOMB",
          "ssn": "666-70-1020",
          "dob": "05-04-1952",
          "zip": "93109"
        }
      },
      "eviction": {
        "subjectInfo": {
          "first": "DOLORES",
          "last": "WHITCOMB",
          "ssn": "666-70-1020",
          "dob": "05-04-1952",
          "zip": "93109"
        }
      }
    }
  }
};

/**
 * Printed card codes: 4 digits (2-9 only, no 0/1) typed on a numeric keypad. Embedded copy of
 * design/card-codes.json (the shared table); keep the two in sync.
 */
export const CARD_CODE_ALPHABET = "23456789";
export const personaCodes: Record<string, string> = {
  P01: "9987", P02: "4657", P03: "4579", P04: "4997", P05: "3239",
  P06: "7996", P07: "7356", P08: "9487", P09: "4439", P10: "7962",
  P11: "2536", P12: "7263", P13: "9442", P14: "6735", P15: "3659",
  P16: "4546", P17: "2792", P18: "6896", P19: "5628", P20: "7554",
};

export function personaIdForCode(code: string): string | null {
  const c = code.trim();
  for (const [id, cc] of Object.entries(personaCodes)) if (cc === c) return id;
  return null;
}
