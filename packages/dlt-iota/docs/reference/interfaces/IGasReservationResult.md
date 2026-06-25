# Interface: IGasReservationResult

Interface for gas reservation result from the gas station (with TypeScript camelCase conventions).

## Properties

### sponsorAddress {#sponsoraddress}

> **sponsorAddress**: `string`

The sponsor's on-chain address.

***

### reservationId {#reservationid}

> **reservationId**: `number`

An ID used to reference this particular gas reservation.

***

### gasCoins {#gascoins}

> **gasCoins**: `object`[]

References to the sponsor's coins that will pay gas.
