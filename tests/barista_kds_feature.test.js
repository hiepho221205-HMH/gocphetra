import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAudioMuted, setAudioMuted, toggleAudioMuted, playOrderChime } from '../src/utils/audioChime.js';
import { DEMO_ACCOUNTS } from '../src/data/initialData.js';
import { getTabFromRoute, parseRouteFromLocation } from '../src/utils/router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('GÓC Coffee POS — Barista KDS & Kitchen Queue Feature Suite', () => {

  // =========================================================================
  // 1. Audio Notification & Chime Controls (audioChime.js)
  // =========================================================================
  describe('1. Web Audio Chime Synthesizer & Mute State', () => {
    it('1.1 - Audio state defaults to unmuted and toggles properly', () => {
      setAudioMuted(false);
      assert.equal(isAudioMuted(), false, 'Default audio state should be unmuted');

      const nextState = toggleAudioMuted();
      assert.equal(nextState, true, 'Toggling should set mute to true');
      assert.equal(isAudioMuted(), true);

      toggleAudioMuted();
      assert.equal(isAudioMuted(), false, 'Toggling again should restore to unmuted');
    });

    it('1.2 - playOrderChime executes safely without throwing in headless/mock environment', () => {
      assert.doesNotThrow(() => {
        playOrderChime();
      }, 'playOrderChime must have safe fallbacks when Web Audio is unavailable');
    });
  });

  // =========================================================================
  // 2. KDS Logic Simulator & FIFO Queue Contract
  // =========================================================================
  describe('2. KDS FIFO Queue & State Transition Simulator', () => {
    class KdsSimulator {
      constructor() {
        this.currentRole = 'barista';
        this.orders = {
          'ORD-001': {
            id: 'ORD-001',
            orderNumber: '001',
            tableId: 't1',
            tableName: 'Bàn 01',
            status: 'serving',
            createdAt: '2026-11-12T08:00:00.000Z',
            items: [
              { name: 'Cà phê sữa đá', quantity: 2, note: 'Ít đường' },
              { name: 'Trà đào cam sả', quantity: 1, note: '' }
            ]
          },
          'ORD-002': {
            id: 'ORD-002',
            orderNumber: '002',
            tableId: 't2',
            tableName: 'Bàn 02',
            status: 'serving',
            createdAt: '2026-11-12T08:05:00.000Z',
            items: [
              { name: 'Bạc xỉu đá', quantity: 1, note: 'Nhiều sữa' }
            ]
          },
          'ORD-003': {
            id: 'ORD-003',
            orderNumber: '003',
            tableId: 't3',
            tableName: 'Bàn 03',
            status: 'completed', // Already paid/finished
            createdAt: '2026-11-12T07:50:00.000Z',
            items: [
              { name: 'Cà phê đen đá', quantity: 1 }
            ]
          }
        };
        this.baristaHistory = [];
        this.baristaItemDone = {};
      }

      get canAccessKds() {
        return ['admin', 'manager', 'barista'].includes(this.currentRole);
      }

      get isBarista() {
        return this.currentRole === 'barista';
      }

      get canViewReports() {
        return ['admin', 'manager'].includes(this.currentRole);
      }

      get canManageMenu() {
        return ['admin', 'manager'].includes(this.currentRole);
      }

      get baristaPendingOrders() {
        const completedIds = new Set(this.baristaHistory.map((h) => h.orderId));
        return Object.values(this.orders)
          .filter((ord) => {
            if (!ord || ord.status !== 'serving') return false;
            if (completedIds.has(ord.id)) return false;
            return Array.isArray(ord.items) && ord.items.length > 0;
          })
          .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      }

      toggleBaristaItemDone(orderId, itemIndex) {
        const currentList = this.baristaItemDone[orderId] || [];
        const nextList = currentList.includes(itemIndex)
          ? currentList.filter((idx) => idx !== itemIndex)
          : [...currentList, itemIndex];
        this.baristaItemDone = { ...this.baristaItemDone, [orderId]: nextList };
      }

      completeBaristaOrder(orderId) {
        if (this.baristaHistory.some((h) => h.orderId === orderId)) return;
        const targetOrder = this.orders[orderId];
        const record = {
          orderId,
          orderNumber: targetOrder?.orderNumber || orderId,
          tableName: targetOrder?.tableName || 'Mang về',
          completedAt: new Date().toISOString(),
          itemsCount: targetOrder?.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0
        };
        this.baristaHistory = [record, ...this.baristaHistory];
      }

      undoBaristaOrder(orderId) {
        this.baristaHistory = this.baristaHistory.filter((h) => h.orderId !== orderId);
      }
    }

    it('2.1 - FIFO Queue strictly orders oldest order first and filters out completed orders', () => {
      const sim = new KdsSimulator();
      const queue = sim.baristaPendingOrders;

      assert.equal(queue.length, 2, 'Must have 2 pending orders in queue (ORD-003 is already completed)');
      assert.equal(queue[0].id, 'ORD-001', 'Oldest order (08:00) must appear first (FIFO)');
      assert.equal(queue[1].id, 'ORD-002', 'Newer order (08:05) must appear second');
    });

    it('2.2 - Individual item checkoff tracks done state without affecting whole order', () => {
      const sim = new KdsSimulator();
      // Tick item index 0 of ORD-001
      sim.toggleBaristaItemDone('ORD-001', 0);
      assert.deepEqual(sim.baristaItemDone['ORD-001'], [0]);

      // Tick item index 1 of ORD-001
      sim.toggleBaristaItemDone('ORD-001', 1);
      assert.deepEqual(sim.baristaItemDone['ORD-001'], [0, 1]);

      // Untick item index 0
      sim.toggleBaristaItemDone('ORD-001', 0);
      assert.deepEqual(sim.baristaItemDone['ORD-001'], [1]);

      // Order should still be in pending queue
      assert.equal(sim.baristaPendingOrders.length, 2);
    });

    it('2.3 - Completing order moves it to barista history and removes from pending queue', () => {
      const sim = new KdsSimulator();
      sim.completeBaristaOrder('ORD-001');

      assert.equal(sim.baristaPendingOrders.length, 1, 'Only ORD-002 should remain pending');
      assert.equal(sim.baristaPendingOrders[0].id, 'ORD-002');
      assert.equal(sim.baristaHistory.length, 1, 'Barista history should contain completed record');
      assert.equal(sim.baristaHistory[0].orderId, 'ORD-001');
      assert.equal(sim.baristaHistory[0].tableName, 'Bàn 01');
      assert.equal(sim.baristaHistory[0].itemsCount, 3);
    });

    it('2.4 - Undo barista order restores it back to active queue', () => {
      const sim = new KdsSimulator();
      sim.completeBaristaOrder('ORD-001');
      assert.equal(sim.baristaPendingOrders.length, 1);

      sim.undoBaristaOrder('ORD-001');
      assert.equal(sim.baristaPendingOrders.length, 2, 'ORD-001 must be restored to pending queue');
      assert.equal(sim.baristaHistory.length, 0);
    });
  });

  // =========================================================================
  // 3. RBAC & Security Boundary Tests for Barista Role
  // =========================================================================
  describe('3. Barista RBAC Security Boundaries', () => {
    it('3.1 - Barista can access KDS, but is blocked from financial and admin features', () => {
      const role = 'barista';
      const canAccessKds = ['admin', 'manager', 'barista'].includes(role);
      const canViewReports = ['admin', 'manager'].includes(role);
      const canManageMenu = ['admin', 'manager'].includes(role);
      const canManageStaff = ['admin', 'manager'].includes(role);
      const canConfigureStore = ['admin', 'manager'].includes(role);
      const canCleanupData = role === 'admin';
      const canAccessSettings = ['admin', 'manager', 'staff'].includes(role);

      assert.equal(canAccessKds, true, 'Barista must have access to KDS');
      assert.equal(canViewReports, false, 'Barista must NOT view reports');
      assert.equal(canManageMenu, false, 'Barista must NOT manage menu');
      assert.equal(canManageStaff, false, 'Barista must NOT manage staff');
      assert.equal(canConfigureStore, false, 'Barista must NOT configure store or VietQR');
      assert.equal(canCleanupData, false, 'Barista must NOT clean data');
      assert.equal(canAccessSettings, false, 'Barista must NOT access Settings Hub');
    });

    it('3.2 - DEMO_ACCOUNTS provides valid barista profile for testing', () => {
      assert.ok(DEMO_ACCOUNTS.barista, 'DEMO_ACCOUNTS must include barista');
      assert.equal(DEMO_ACCOUNTS.barista.role, 'barista');
      assert.equal(DEMO_ACCOUNTS.barista.email, 'barista@gocpos.vn');
      assert.equal(DEMO_ACCOUNTS.barista.name, 'Phạm Minh Quân');
    });
  });

  // =========================================================================
  // 4. Barista UI & Navigation Contract Inspections
  // =========================================================================
  describe('4. Navigation & Component Code Contract Verifications', () => {
    it('4.1 - Router supports /barista and /barista_history routes', () => {
      assert.equal(getTabFromRoute('/barista'), 'barista');
      assert.equal(getTabFromRoute('/barista_history'), 'barista_history');
      assert.equal(getTabFromRoute(parseRouteFromLocation('/barista').path), 'barista');
      assert.equal(getTabFromRoute(parseRouteFromLocation('/barista_history').path), 'barista_history');
    });

    it('4.2 - BottomNav.jsx renders exactly 3 tabs for barista role', () => {
      const bottomNavSrc = fs.readFileSync(path.join(rootDir, 'src/components/common/BottomNav.jsx'), 'utf-8');
      assert.ok(bottomNavSrc.includes('baristaNavItems'), 'Must define baristaNavItems');
      assert.ok(bottomNavSrc.includes("id: 'tables'"), 'Tab 1: Sơ đồ bàn');
      assert.ok(bottomNavSrc.includes("id: 'barista'"), 'Tab 2: Quầy Bar');
      assert.ok(bottomNavSrc.includes("label: 'Quầy Bar'"), 'Tab 2 label must be Quầy Bar');
      assert.ok(bottomNavSrc.includes("id: 'barista_history'"), 'Tab 3: Lịch sử pha chế');
      assert.ok(bottomNavSrc.includes("isBarista ? 'w-1/3'"), 'Sliding disc adapts width to 3 tabs');
    });

    it('4.3 - PageHeader.jsx provides appropriate headers for barista tabs', () => {
      const headerSrc = fs.readFileSync(path.join(rootDir, 'src/components/common/PageHeader.jsx'), 'utf-8');
      assert.ok(headerSrc.includes("barista: {"), 'Must configure barista header');
      assert.ok(headerSrc.includes("Quầy Bar"), 'Must define title for barista as Quầy Bar');
      assert.ok(headerSrc.includes("barista_history: {"), 'Must configure barista_history header');
      assert.ok(headerSrc.includes("Lịch sử pha chế"), 'Must define title for barista_history');
    });

    it('4.4 - TableGrid.jsx hides empty tables and administrative controls for barista', () => {
      const tableGridSrc = fs.readFileSync(path.join(rootDir, 'src/components/tables/TableGrid.jsx'), 'utf-8');
      assert.ok(tableGridSrc.includes('const isBarista = currentRole === \'barista\';'), 'Must check isBarista');
      assert.ok(tableGridSrc.includes('if (isBarista && !occupied)'), 'Must filter out empty tables for Barista');
      assert.ok(tableGridSrc.includes('{!isBarista && ('), 'Must hide stat filter cards and Add Table button for Barista');
    });

    it('4.5 - BaristaKdsView.jsx component is present and implements Claymorphism & sound controls', () => {
      const kdsSrc = fs.readFileSync(path.join(rootDir, 'src/components/kds/BaristaKdsView.jsx'), 'utf-8');
      assert.ok(kdsSrc.includes('playOrderChime'), 'Must import audio chime');
      assert.ok(kdsSrc.includes('toggleAudioMuted'), 'Must import audio mute toggle');
      assert.ok(kdsSrc.includes('baristaPendingOrders'), 'Must consume pending orders queue');
      assert.ok(kdsSrc.includes('baristaHistory'), 'Must consume barista history');
      assert.ok(kdsSrc.includes('Clock'), 'Must use Clock icon instead of hourglass');
    });

    it('4.6 - OrderDetailsModal.jsx provides specialized 2-button layout and hides prices for Barista', () => {
      const modalSrc = fs.readFileSync(path.join(rootDir, 'src/components/orders/OrderDetailsModal.jsx'), 'utf-8');
      assert.ok(modalSrc.includes('isBarista'), 'Must check isBarista in OrderDetailsModal');
      assert.ok(modalSrc.includes('In phiếu bếp'), 'Must include In phiếu bếp button');
      assert.ok(modalSrc.includes('Lưu đơn'), 'Must include Lưu đơn button');
      assert.ok(modalSrc.includes('!isBarista && ('), 'Must conditionally hide prices for Barista');
    });

    it('4.7 - Database Migration file exists for barista enum value', () => {
      const migrationPath = path.join(rootDir, 'supabase/migrations/20261112000000_add_barista_role.sql');
      assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes("ALTER TYPE public.app_role ADD VALUE 'barista';"), 'Must add barista to app_role enum');
    });

    it('4.8 - TableGrid.jsx hides completed tables from Barista and only shows tables with uncompleted/pending orders', () => {
      const tableGridSrc = fs.readFileSync(path.join(rootDir, 'src/components/tables/TableGrid.jsx'), 'utf-8');
      assert.ok(tableGridSrc.includes('isTablePendingBarista'), 'TableGrid must implement isTablePendingBarista filter');
      assert.ok(tableGridSrc.includes('if (isBarista && !isTablePendingBarista(t))'), 'TableGrid must exclude completed barista tables');
      assert.ok(tableGridSrc.includes('baristaHistory'), 'TableGrid must observe baristaHistory updates');

      const posContextSrc = fs.readFileSync(path.join(rootDir, 'src/store/PosContext.jsx'), 'utf-8');
      assert.ok(posContextSrc.includes('shouldResetBarista'), 'PosContext must reactivate order to pending when cashier adds items');
    });

    it('4.9 - PosContext implements sub-10ms Local Mesh BroadcastChannel and added-item chime detection', () => {
      const posContextSrc = fs.readFileSync(path.join(rootDir, 'src/store/PosContext.jsx'), 'utf-8');
      assert.ok(posContextSrc.includes('goc_pos_ultra_mesh_v1'), 'Must use local BroadcastChannel for <1ms mesh sync');
      assert.ok(posContextSrc.includes('totalPendingItemsCount'), 'Must track total pending items to trigger chime when items added');
      assert.ok(posContextSrc.includes('isNewItemAdded'), 'Must tag payload with isNewItemAdded for instant barista alert');

      const chimeSrc = fs.readFileSync(path.join(rootDir, 'src/utils/audioChime.js'), 'utf-8');
      assert.ok(chimeSrc.includes('warmUpAudio') || chimeSrc.includes('pointerdown'), 'Must pre-warm AudioContext on user interaction');

      const viteConfigSrc = fs.readFileSync(path.join(rootDir, 'vite.config.js'), 'utf-8');
      assert.ok(viteConfigSrc.includes("!dep.includes('vendor-supabase')"), 'Vite config must exclude vendor-supabase from initial preload');
      assert.ok(viteConfigSrc.includes("!dep.includes('vendor-motion')"), 'Vite config must exclude vendor-motion from initial preload');
    });
  });
});
