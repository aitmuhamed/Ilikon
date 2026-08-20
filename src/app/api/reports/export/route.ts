import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { ApiError, route } from '@/lib/api'
import {
  getSalesTimeSeries,
  getTopCustomers,
  getTopProducts,
  resolveRange,
  toCsv,
} from '@/lib/reports'
import { can } from '@/lib/auth'
import { audit } from '@/lib/audit'

/** CSV export for the admin reports screens. */
export const GET = route({
  auth: { permission: 'reports.export' },
  async handler({ query, session, request }) {
    const type = query.get('type') ?? 'sales'
    const range = resolveRange(query.get('range') ?? '30d', query.get('from') ?? undefined, query.get('to') ?? undefined)

    let rows: Record<string, unknown>[] = []
    let filename = 'report'

    switch (type) {
      case 'sales': {
        rows = (await getSalesTimeSeries(range)).map((point) => ({
          date: point.date,
          orders: point.orders,
          sales_mnt: point.sales,
        }))
        filename = 'sales'
        break
      }
      case 'products': {
        rows = (await getTopProducts(range, 500)).map((product) => ({
          sku: product.sku,
          name: product.name,
          units_sold: product.quantity,
          revenue_mnt: product.revenue,
        }))
        filename = 'products'
        break
      }
      case 'customers': {
        // Contact columns are only included for staff allowed to see them.
        const showContact = can(session, 'customers.viewContact')
        rows = (await getTopCustomers(range, 500)).map((customer) => ({
          name: customer.name,
          ...(showContact ? { phone: customer.phone, email: customer.email ?? '' } : {}),
          orders: customer.orders,
          revenue_mnt: customer.revenue,
        }))
        filename = 'customers'
        break
      }
      case 'inventory': {
        const products = await prisma.product.findMany({
          where: { deletedAt: null, status: { not: 'ARCHIVED' } },
          select: {
            sku: true,
            name: true,
            price: true,
            expiryDate: true,
            inventory: { select: { quantity: true, lowStockThreshold: true, shelfLocation: true } },
            category: { select: { name: true } },
          },
          orderBy: { name: 'asc' },
        })
        rows = products.map((product) => ({
          sku: product.sku,
          name: product.name,
          category: product.category.name,
          price_mnt: product.price,
          quantity: product.inventory?.quantity ?? 0,
          low_stock_threshold: product.inventory?.lowStockThreshold ?? 0,
          shelf: product.inventory?.shelfLocation ?? '',
          expiry_date: product.expiryDate?.toISOString().slice(0, 10) ?? '',
        }))
        filename = 'inventory'
        break
      }
      case 'orders': {
        const orders = await prisma.order.findMany({
          where: { createdAt: { gte: range.from, lte: range.to } },
          select: {
            orderNumber: true,
            status: true,
            customerName: true,
            subtotal: true,
            discountTotal: true,
            deliveryFee: true,
            total: true,
            createdAt: true,
            payment: { select: { method: true, status: true } },
            delivery: { select: { method: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
        rows = orders.map((order) => ({
          order_number: order.orderNumber,
          status: order.status,
          customer: order.customerName,
          subtotal_mnt: order.subtotal,
          discount_mnt: order.discountTotal,
          delivery_fee_mnt: order.deliveryFee,
          total_mnt: order.total,
          payment_method: order.payment?.method ?? '',
          payment_status: order.payment?.status ?? '',
          delivery_method: order.delivery?.method ?? '',
          delivery_status: order.delivery?.status ?? '',
          created_at: order.createdAt.toISOString(),
        }))
        filename = 'orders'
        break
      }
      default:
        throw new ApiError(400, 'UNKNOWN_REPORT', 'Unknown report type')
    }

    await audit({
      actor: session,
      action: 'report.export',
      entity: 'Report',
      summary: `${type} (${range.from.toISOString().slice(0, 10)} → ${range.to.toISOString().slice(0, 10)}), ${rows.length} rows`,
      request,
    })

    // BOM so Excel opens Cyrillic correctly.
    const csv = `﻿${toCsv(rows)}`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="ilikon-${filename}-${range.from
          .toISOString()
          .slice(0, 10)}.csv"`,
        'cache-control': 'no-store',
      },
    })
  },
})

export const dynamic = 'force-dynamic'

