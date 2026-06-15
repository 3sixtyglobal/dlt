# Interface: IIotaResponseOptions

Options for controlling transaction execution and response behaviour.

## Extends

- `IotaTransactionBlockResponseOptions`

## Properties

### waitForConfirmation? {#waitforconfirmation}

> `optional` **waitForConfirmation?**: `boolean`

Wait for confirmation of the transaction.

#### Default

```ts
true
```

***

### dryRunLabel? {#dryrunlabel}

> `optional` **dryRunLabel?**: `string`

Dry run the transaction with this label, if not set no dry run will occur.
