// LocalStorage Schema Migrator & Safe Storage Manager
export const LOCAL_SCHEMA_VERSION = 7;
const VERSION_KEY = 'goc_storage_schema_version';

export function runStorageMigrations() {
  try {
    const rawVersion = localStorage.getItem(VERSION_KEY);
    const savedVersion = rawVersion ? Number(rawVersion) : 4;

    if (savedVersion < LOCAL_SCHEMA_VERSION) {
      console.info(`[Migrator] Nâng cấp cấu trúc dữ liệu từ schema v${savedVersion} lên v${LOCAL_SCHEMA_VERSION}...`);

      // Migration v4 -> v5: Đảm bảo các đơn hàng có trường splitPayments và notes an toàn
      if (savedVersion < 5) {
        const rawOrders = localStorage.getItem('goc_pos_orders_v4');
        if (rawOrders) {
          try {
            const parsed = JSON.parse(rawOrders);
            let changed = false;
            Object.keys(parsed).forEach((orderId) => {
              const ord = parsed[orderId];
              if (!Array.isArray(ord.splitPayments)) {
                ord.splitPayments = [];
                changed = true;
              }
              if (ord.discountPercent === undefined) {
                ord.discountPercent = 0;
                changed = true;
              }
            });
            if (changed) {
              localStorage.setItem('goc_pos_orders_v4', JSON.stringify(parsed));
            }
          } catch (e) {
            console.warn('[Migrator] Lỗi khi migrate orders v4:', e);
          }
        }
      }

      // Migration v5 -> v6: Dọn dẹp sạch cache bán hàng cục bộ cũ để đồng bộ 100% từ Supabase PostgreSQL SSOT
      if (savedVersion < 6) {
        console.info('[Migrator] Nâng cấp schema v6: Làm sạch cache cục bộ cũ để thiết lập Supabase SSOT...');
        localStorage.removeItem('goc_pos_orders_v4');
        localStorage.removeItem('goc_pos_history_v4');
        localStorage.removeItem('goc_pos_tables_v4');
        localStorage.removeItem('goc_pos_menu_v4');
      }

      // Migration v6 -> v7: Dọn dẹp cache nhân sự cũ để đồng bộ 100% 7 tài khoản từ Supabase SSOT
      if (savedVersion < 7) {
        console.info('[Migrator] Nâng cấp schema v7: Dọn dẹp cache nhân sự cũ để đồng bộ 100% từ Supabase...');
        localStorage.removeItem('goc_pos_staff_v4');
        localStorage.removeItem('goc_user_profiles_v4');
        localStorage.removeItem('goc_schema_capabilities');
      }

      // Đánh dấu đã nâng cấp thành công
      localStorage.setItem(VERSION_KEY, String(LOCAL_SCHEMA_VERSION));
      console.info(`[Migrator] Hoàn tất di trú schema v${LOCAL_SCHEMA_VERSION}`);
    }
  } catch (err) {
    console.error('[Migrator] Lỗi chạy migration LocalStorage:', err);
  }
}

// Hàm xuất toàn bộ dữ liệu POS thành file JSON để quản lý lưu dự phòng
export function exportPosBackup() {
  try {
    const keys = [
      'goc_pos_tables_v4',
      'goc_pos_categories_v4',
      'goc_pos_menu_v4',
      'goc_pos_toppings_v4',
      'goc_pos_product_toppings_v4',
      'goc_pos_orders_v4',
      'goc_pos_history_v4',
      'goc_pos_settings_v4',
      VERSION_KEY
    ];

    const backupData = {
      exportedAt: new Date().toISOString(),
      schemaVersion: LOCAL_SCHEMA_VERSION,
      data: {}
    };

    keys.forEach((key) => {
      const val = localStorage.getItem(key);
      if (val !== null) {
        try {
          backupData.data[key] = JSON.parse(val);
        } catch {
          backupData.data[key] = val;
        }
      }
    });

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute('download', `goc_coffee_pos_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    return { success: true, message: 'Đã xuất file dự phòng thành công!' };
  } catch (err) {
    console.error('Lỗi xuất file dự phòng:', err);
    return { success: false, message: 'Lỗi xuất file dự phòng: ' + err.message };
  }
}
