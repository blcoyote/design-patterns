package main

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// [domainModel]
type ShipmentStatus string

const (
	Pending   ShipmentStatus = "Pending"
	InTransit ShipmentStatus = "InTransit"
	Delivered ShipmentStatus = "Delivered"
	Unknown   ShipmentStatus = "Unknown"
)

type Shipment struct {
	OrderID           string
	Status            ShipmentStatus
	EstimatedDelivery *string // ISO "YYYY-MM-DD", nil when unknown
}

// [/domainModel]

// [legacySystem]
type LegacyShipmentRecord struct {
	Trk  string
	Stat int    // 0 pending, 1 in transit, 2 delivered — anything else is an unmapped legacy code
	Eta  string // "MM/DD/YYYY", sometimes empty or malformed
}

type LegacyShippingSystem struct{}

// [lookup]
func (l *LegacyShippingSystem) Lookup(orderID string) LegacyShipmentRecord {
	if orderID == "O-1001" {
		return LegacyShipmentRecord{Trk: orderID, Stat: 1, Eta: "04/02/2025"}
	}
	// O-2002: a corrupt record from the legacy system — an unmapped status code and an impossible date
	return LegacyShipmentRecord{Trk: orderID, Stat: 9, Eta: "02/30/2025"}
}

// [/lookup]
// [/legacySystem]

// [acl]
type ShippingAntiCorruptionLayer struct {
	legacy *LegacyShippingSystem
}

// [translate]
func (a *ShippingAntiCorruptionLayer) GetShipment(orderID string) Shipment {
	record := a.legacy.Lookup(orderID)
	return Shipment{
		OrderID:           orderID,
		Status:            translateStatus(record.Stat),
		EstimatedDelivery: parseEta(record.Eta),
	}
}

func translateStatus(stat int) ShipmentStatus {
	switch stat {
	case 0:
		return Pending
	case 1:
		return InTransit
	case 2:
		return Delivered
	default:
		// An unmapped legacy code never reaches the domain as a raw number.
		return Unknown
	}
}

func parseEta(eta string) *string {
	parts := strings.Split(eta, "/")
	if len(parts) != 3 {
		return nil // a malformed legacy date never reaches the domain either
	}
	month, errM := strconv.Atoi(parts[0])
	day, errD := strconv.Atoi(parts[1])
	year, errY := strconv.Atoi(parts[2])
	if errM != nil || errD != nil || errY != nil {
		return nil
	}
	t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	// time.Date silently normalizes an invalid day/month into the next one (Feb 30 becomes Mar 2)
	// instead of rejecting it, so round-trip the components to catch that instead of returning
	// a shifted date.
	if int(t.Month()) != month || t.Day() != day || t.Year() != year {
		return nil
	}
	iso := t.Format("2006-01-02")
	return &iso
}

// [/translate]
// [/acl]

// [trackingService]
type OrderTrackingService struct {
	acl *ShippingAntiCorruptionLayer
}

func (s *OrderTrackingService) Describe(orderID string) string {
	shipment := s.acl.GetShipment(orderID)
	eta := "unknown"
	if shipment.EstimatedDelivery != nil {
		eta = *shipment.EstimatedDelivery
	}
	return fmt.Sprintf("%s: %s, ETA %s", shipment.OrderID, shipment.Status, eta)
}

// [/trackingService]

// [usage]
func main() {
	trackingService := &OrderTrackingService{
		acl: &ShippingAntiCorruptionLayer{legacy: &LegacyShippingSystem{}},
	}
	fmt.Println(trackingService.Describe("O-1001"))
	fmt.Println(trackingService.Describe("O-2002"))
}

// [/usage]
