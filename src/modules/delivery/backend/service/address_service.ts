// address_service.ts
// Customer structured address repository and service

import { db } from '../../../../core/backend/db';
import { CustomerAddress } from '../../types/delivery.types';

export class AddressService {
  private get db() {
    return db;
  }

  public getAddressesByCustomer(customerId: number): CustomerAddress[] {
    const stmt = this.db.prepare(`
      SELECT * FROM customer_addresses
      WHERE customer_id = ?
      ORDER BY is_default DESC, created_at DESC
    `);
    return stmt.all(customerId) as CustomerAddress[];
  }

  public getAddressById(addressId: number): CustomerAddress | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM customer_addresses
      WHERE id = ?
    `);
    return stmt.get(addressId) as CustomerAddress | undefined;
  }

  public getDefaultAddress(customerId: number): CustomerAddress | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM customer_addresses
      WHERE customer_id = ? AND is_default = 1
      LIMIT 1
    `);
    return stmt.get(customerId) as CustomerAddress | undefined;
  }

  public createAddress(address: Partial<CustomerAddress> & { customer_id: number; area: string; pincode: string }): CustomerAddress {
    const isFirstAddress = this.getAddressesByCustomer(address.customer_id).length === 0;
    const isDefault = address.is_default || isFirstAddress ? 1 : 0;

    const tx = this.db.transaction(() => {
      if (isDefault === 1) {
        this.db.prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?').run(address.customer_id);
      }

      const stmt = this.db.prepare(`
        INSERT INTO customer_addresses (
          customer_id, label, door_no, building, street, area,
          landmark, city, district, state, pincode, latitude,
          longitude, delivery_instructions, is_default
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?
        )
      `);

      const result = stmt.run(
        address.customer_id,
        address.label || 'Home',
        address.door_no || null,
        address.building || null,
        address.street || null,
        address.area,
        address.landmark || null,
        address.city || 'Bengaluru',
        address.district || null,
        address.state || 'Karnataka',
        address.pincode,
        address.latitude || null,
        address.longitude || null,
        address.delivery_instructions || null,
        isDefault
      );

      return this.getAddressById(Number(result.lastInsertRowid))!;
    });

    return tx();
  }

  public updateAddress(addressId: number, updates: Partial<CustomerAddress>): CustomerAddress {
    const existing = this.getAddressById(addressId);
    if (!existing) {
      throw new Error(`Customer address #${addressId} not found.`);
    }

    const tx = this.db.transaction(() => {
      if (updates.is_default === 1) {
        this.db.prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?').run(existing.customer_id);
      }

      const stmt = this.db.prepare(`
        UPDATE customer_addresses SET
          label = COALESCE(?, label),
          door_no = COALESCE(?, door_no),
          building = COALESCE(?, building),
          street = COALESCE(?, street),
          area = COALESCE(?, area),
          landmark = COALESCE(?, landmark),
          city = COALESCE(?, city),
          district = COALESCE(?, district),
          state = COALESCE(?, state),
          pincode = COALESCE(?, pincode),
          latitude = COALESCE(?, latitude),
          longitude = COALESCE(?, longitude),
          delivery_instructions = COALESCE(?, delivery_instructions),
          is_default = COALESCE(?, is_default),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        updates.label ?? null,
        updates.door_no ?? null,
        updates.building ?? null,
        updates.street ?? null,
        updates.area ?? null,
        updates.landmark ?? null,
        updates.city ?? null,
        updates.district ?? null,
        updates.state ?? null,
        updates.pincode ?? null,
        updates.latitude ?? null,
        updates.longitude ?? null,
        updates.delivery_instructions ?? null,
        updates.is_default ?? null,
        addressId
      );

      return this.getAddressById(addressId)!;
    });

    return tx();
  }

  public setDefaultAddress(addressId: number): void {
    const existing = this.getAddressById(addressId);
    if (!existing) {
      throw new Error(`Customer address #${addressId} not found.`);
    }

    this.db.transaction(() => {
      this.db.prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?').run(existing.customer_id);
      this.db.prepare('UPDATE customer_addresses SET is_default = 1 WHERE id = ?').run(addressId);
    })();
  }

  public deleteAddress(addressId: number): void {
    this.db.prepare('DELETE FROM customer_addresses WHERE id = ?').run(addressId);
  }
}

export const addressService = new AddressService();
