// MXH Account Actions and Modal Handlers
(function () {
    let ctx = null;
    
    let _openWeChatModalLock = false;

    function init(context) {
        ctx = context;
        window.MXHAccountNotices?.init(context);
        bindEvents();
    }

    // Context getters for easy access inside extracted functions
    // We replace global variables with ctx. variables in the extracted code


    function bindEvents() {
        // Event listeners are bound within the init step for modal buttons.
        // The extracted code already contains the event listeners attached to document.
    }

    // ==========================================
    // EXTRACTED FUNCTIONS
    // ==========================================
        // Ensure platform group exists
        async function ensurePlatformGroup(platform) {
            const existingGroup = ctx.mxhGroups.find(g => g.name.toLowerCase() === platform.toLowerCase());
            if (existingGroup) {
                return existingGroup.id;
            }

            try {
                const response = await ctx.MXHApi.createGroup({
                    name: platform.charAt(0).toUpperCase() + platform.slice(1),
                    color: ctx.getPlatformColor(platform)
                });

                if (response.ok) {
                    const newGroup = await response.json();
                    ctx.mxhGroups.push(newGroup);
                    return newGroup.id;
                } else {
                    throw new Error('Failed to create group');
                }
            } catch (error) {
                console.error('Error creating platform group:', error);
                throw error;
            }
        }
        // Get next card number (per platform/group)
        async function getNextCardNumber(groupId) {
            // Get all accounts in the same group
            const groupAccounts = ctx.mxhAccounts.filter(acc => acc.group_id === groupId);
            const numbers = groupAccounts.map(acc => parseInt(acc.card_name)).filter(n => !isNaN(n));

            if (numbers.length === 0) return 1;

            // Find first available number starting from 1
            for (let i = 1; i <= numbers.length + 1; i++) {
                if (!numbers.includes(i)) {
                    return i;
                }
            }
            return Math.max(...numbers) + 1;
        }
        // === Di Chuyển Tài Khoản sang Card khác ===
        function openMoveAccountModal(accountId) {
            const account = ctx.mxhAccounts.find(acc => acc.id === accountId);
            if (!account) return;

            document.getElementById('move-account-name').value = account.username || 'Không tên';
            document.getElementById('move-account-current-card').value = `Card ${account.card_name || '?'}`;
            document.getElementById('move-account-target-card').value = '';
            document.getElementById('move-account-error').style.display = 'none';
            document.getElementById('move-account-error').textContent = '';

            // Store account id for confirm handler
            document.getElementById('move-account-modal').dataset.accountId = accountId;

            const modal = new bootstrap.Modal(document.getElementById('move-account-modal'));
            modal.show();
        }

        document.getElementById('move-account-confirm-btn').addEventListener('click', async () => {
            const modalEl = document.getElementById('move-account-modal');
            const accountId = parseInt(modalEl.dataset.accountId);
            const targetCardName = document.getElementById('move-account-target-card').value.trim();
            const errorEl = document.getElementById('move-account-error');

            if (!targetCardName) {
                errorEl.textContent = 'Vui lòng nhập số card đích!';
                errorEl.style.display = 'block';
                return;
            }

            const account = ctx.mxhAccounts.find(acc => acc.id === accountId);
            if (!account) {
                errorEl.textContent = 'Không tìm thấy tài khoản!';
                errorEl.style.display = 'block';
                return;
            }

            // Prevent moving primary account
            if (account.is_primary) {
                errorEl.textContent = 'Không thể di chuyển tài khoản chính!';
                errorEl.style.display = 'block';
                return;
            }

            // Check same card
            if (account.card_name === targetCardName) {
                errorEl.textContent = 'Tài khoản đã thuộc card này!';
                errorEl.style.display = 'block';
                return;
            }

            // Find target card from ctx.mxhAccounts (find any account with matching card_name in same group)
            const targetAccount = ctx.mxhAccounts.find(acc =>
                acc.card_name === targetCardName && acc.group_id === account.group_id
            );

            if (!targetAccount) {
                errorEl.textContent = `Không tìm thấy Card ${targetCardName} trong cùng nhóm!`;
                errorEl.style.display = 'block';
                return;
            }

            const targetCardId = targetAccount.card_id;

            try {
                const response = await ctx.MXHApi.moveAccount(accountId, { target_card_id: targetCardId });

                if (response.ok) {
                    const result = await response.json();

                    // Update local data
                    const accountIndex = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
                    if (accountIndex !== -1) {
                        ctx.mxhAccounts[accountIndex].card_id = targetCardId;
                        ctx.mxhAccounts[accountIndex].card_name = targetCardName;
                    }

                    // Close modal and re-render
                    bootstrap.Modal.getInstance(modalEl).hide();
                    ctx.requestFullRebuild();
                    ctx.scheduleRender();
                    ctx.showToast(`✅ Đã chuyển tài khoản sang Card ${targetCardName}!`, 'success');
                } else {
                    const err = await response.json();
                    errorEl.textContent = err.error || 'Lỗi không xác định!';
                    errorEl.style.display = 'block';
                }
            } catch (error) {
                errorEl.textContent = 'Lỗi kết nối: ' + error.message;
                errorEl.style.display = 'block';
            }
        });
        // === NEW: Create Sub-Account ===
        async function createSubAccount(cardId, containerType) {
            try {
                // 🔍 Get current date for new sub-account
                const today = new Date();
                const currentDay = today.getDate();
                const currentMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
                const currentYear = today.getFullYear();

                console.log('🔍 Creating sub-account with date:', { day: currentDay, month: currentMonth, year: currentYear, containerType });

                const payload: any = {
                    wechat_created_day: currentDay,
                    wechat_created_month: currentMonth,
                    wechat_created_year: currentYear
                };
                if (containerType) {
                    payload.container_type = containerType;
                }

                const response = await ctx.MXHApi.createSubAccount(cardId, payload);

                if (response.ok) {
                    const newAccount = await response.json();
                    console.log('🔍 New account created:', newAccount);
                    console.log('🔍 New account full data:', JSON.stringify(newAccount, null, 2));

                    // 🔍 Merge dữ liệu mới vào ctx.mxhAccounts ngay lập tức để badge có thể tính toán
                    const existingIndex = ctx.mxhAccounts.findIndex(a => a.id === newAccount.id);
                    if (existingIndex >= 0) {
                        ctx.mxhAccounts[existingIndex] = newAccount;
                    } else {
                        ctx.mxhAccounts.push(newAccount);
                    }

                    // 🔍 Reload all data to ensure consistency and get full card info
                    await ctx.loadMXHData(true);

                    console.log('🔍 Data reloaded, ctx.mxhAccounts count:', ctx.mxhAccounts.length);

                    // 🔍 Gọi render lại ngay để badge được cập nhật
                    ctx.scheduleRender();

                    // Wait a bit more for render to complete, then flip to new account
                    setTimeout(() => {
                        console.log('🔍 Attempting to flip to account:', newAccount.id);
                        const accountExists = ctx.mxhAccounts.find(a => a.id === newAccount.id);
                        console.log('🔍 Account exists in ctx.mxhAccounts:', !!accountExists);
                        if (accountExists) {
                            console.log('🔍 Account data:', accountExists);
                        }
                        ctx.flipCardToAccount(cardId, newAccount.id);
                    }, 300);

                    if (typeof showToast === 'function') {
                        ctx.showToast('Đã tạo tài khoản phụ!', 'success');
                    }
                } else {
                    throw new Error('Failed to create sub-account');
                }
            } catch (error) {
                console.error('🔍 Error creating sub-account:', error);
                if (typeof showToast === 'function') {
                    ctx.showToast('Lỗi tạo tài khoản phụ!', 'error');
                }
            }
        }
        // === NEW: Delete Card (và tất cả accounts) ===
        async function deleteCard(cardId) {
            if (!(await ctx.confirm('Xóa card này và tất cả tài khoản trên card?'))) return;

            try {
                const response = await ctx.MXHApi.deleteCard(cardId);

                if (response.ok) {
                    // Remove from local state
                    ctx.mxhAccounts = ctx.mxhAccounts.filter(acc => acc.card_id !== cardId);
                    ctx.MXHState.deleteCardState(cardId);
                    ctx.scheduleRender();
                    if (typeof showToast === 'function') {
                        ctx.showToast('Đã xóa card!', 'success');
                    }
                } else {
                    throw new Error('Failed to delete card');
                }
            } catch (error) {
                console.error('Error deleting card:', error);
                if (typeof showToast === 'function') {
                    ctx.showToast('Lỗi xóa card!', 'error');
                }
            }
        }
        // === NEW: Delete Sub-Account ===
        async function deleteSubAccount(accountId) {
            if (!(await ctx.confirm('Xóa tài khoản phụ này?'))) return;

            try {
                const response = await ctx.MXHApi.deleteSubAccount(accountId);

                if (response.ok) {
                    // Remove from local state
                    // 🔍 Before removing, find the cardId to restore view
                    const subAcc = ctx.mxhAccounts.find(acc => acc.id === accountId);
                    const cardId = subAcc ? subAcc.card_id : null;

                    ctx.mxhAccounts = ctx.mxhAccounts.filter(acc => acc.id !== accountId);

                    // 🔍 Restore view to primary account if cardId exists
                    // 🔍 Restore view to primary account if cardId exists
                    if (cardId) {
                        const cardAccounts = ctx.mxhAccounts.filter(acc => Number(acc.card_id) === Number(cardId));
                        const primaryAcc = cardAccounts.find(acc => acc.is_primary) || cardAccounts[0];
                        if (primaryAcc) {
                            ctx.setCardState(Number(cardId), { activeAccountId: primaryAcc.id });
                            console.log(`🔍 Restored view to primary/first account ${primaryAcc.id} for card ${cardId}`);
                        }
                    }

                    ctx.requestFullRebuild();
                    ctx.scheduleRender();
                    if (typeof showToast === 'function') {
                        ctx.showToast('Đã xóa tài khoản phụ!', 'success');
                    }
                } else {
                    throw new Error('Failed to delete sub-account');
                }
            } catch (error) {
                console.error('Error deleting sub-account:', error);
                if (typeof showToast === 'function') {
                    ctx.showToast('Lỗi xóa tài khoản phụ!', 'error');
                }
            }
        }
        // === NEW: Rescue Account Action ===
        async function rescueAccountAction(accountId, result) {
            try {
                const response = await ctx.MXHApi.rescueAccount(accountId, { result });

                if (response.ok) {
                    // Update local state
                    const accountIndex = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
                    if (accountIndex !== -1) {
                        if (result === 'success') {
                            ctx.mxhAccounts[accountIndex].status = 'active';
                            ctx.mxhAccounts[accountIndex].die_date = null;
                            ctx.mxhAccounts[accountIndex].disabled_date = null;
                            ctx.mxhAccounts[accountIndex].rescue_success_count = (ctx.mxhAccounts[accountIndex].rescue_success_count || 0) + 1;
                        } else {
                            ctx.mxhAccounts[accountIndex].rescue_count = (ctx.mxhAccounts[accountIndex].rescue_count || 0) + 1;
                        }
                    }

                    ctx.scheduleRender();
                    const message = result === 'success' ? '✅ Cứu thành công!' : '📝 Đã ghi nhận cứu thất bại!';
                    if (typeof showToast === 'function') {
                        ctx.showToast(message, 'success');
                    }
                } else {
                    throw new Error('Failed to rescue account');
                }
            } catch (error) {
                console.error('Error rescuing account:', error);
                if (typeof showToast === 'function') {
                    ctx.showToast('Lỗi khi cứu tài khoản!', 'error');
                }
            }
        }
        // === NEW: Scan WeChat Account ===
        async function scanWeChatAccount(accountId) {
            // Instant local update
            const accountIndex = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
            if (accountIndex !== -1) {
                ctx.mxhAccounts[accountIndex].wechat_scan_count = (ctx.mxhAccounts[accountIndex].wechat_scan_count || 0) + 1;
                ctx.mxhAccounts[accountIndex].wechat_last_scan_date = new Date().toISOString();

                // Force full rebuild to ensure UI updates (e.g. scan count color)
                ctx.requestFullRebuild();
                ctx.scheduleRender();
            }

            try {
                const response = await ctx.MXHApi.scanAccount(accountId);

                if (response.ok) {
                    // Merge server response if available
                    const responseData = await response.json();
                    if (responseData && responseData.id) {
                        const idx = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
                        if (idx !== -1) {
                            ctx.mxhAccounts[idx] = responseData;

                            // Force full rebuild again to sync with server data
                            ctx.requestFullRebuild();
                            ctx.scheduleRender();
                        }
                    }

                    if (typeof showToast === 'function') {
                        ctx.showToast('✅ Đã ghi nhận quét WeChat!', 'success');
                    }
                } else {
                    throw new Error('Failed to record scan');
                }
            } catch (error) {
                console.error('Error scanning WeChat:', error);
                if (typeof showToast === 'function') {
                    ctx.showToast('Lỗi khi quét WeChat!', 'error');
                }
            }
        }
        // === NEW: Update Account Status (Disabled = Die UI) ===
        async function updateAccountStatusNew(accountId, status) {
            try {
                const payload: any = { status };

                // 🔍 Disabled (Die UI) ghi nhận ngày disabled, clear die_date cũ
                if (status === 'disabled') {
                    payload.disabled_date = new Date().toISOString().split('T')[0];
                    payload.die_date = null;
                } else {
                    // Active: clear cả die_date/disabled_date
                    payload.die_date = null;
                    payload.disabled_date = null;
                }

                const response = await ctx.MXHApi.updateAccount(accountId, payload);

                if (response.ok) {
                    const updatedAccount = await response.json();

                    // Update local state
                    const index = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
                    if (index !== -1) {
                        ctx.mxhAccounts[index] = updatedAccount;
                    }

                    // Force full rebuild to ensure UI updates (e.g. gray out card)
                    ctx.requestFullRebuild();
                    ctx.scheduleRender();
                    if (typeof showToast === 'function') {
                        ctx.showToast(`Đã cập nhật trạng thái: ${status}`, 'success');
                    }
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to update status');
                }
            } catch (error) {
                console.error('Error updating status:', error);
                if (typeof showToast === 'function') {
                    ctx.showToast(`Lỗi cập nhật trạng thái: ${error.message}`, 'error');
                }
            }
        }
        // === Update wechat_status (UnVerify / Verify Success) ===
        async function updateWechatVerifyStatus(accountId, wechatStatus) {
            try {
                const payload = { wechat_status: wechatStatus || 'available' };

                const response = await ctx.MXHApi.updateAccount(accountId, payload);

                if (response.ok) {
                    const updatedAccount = await response.json();

                    const index = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
                    if (index !== -1) {
                        ctx.mxhAccounts[index] = updatedAccount;
                    }

                    ctx.requestFullRebuild();
                    ctx.scheduleRender();
                    if (typeof showToast === 'function') {
                        const label = wechatStatus === 'unverified' ? 'UnVerify' : 'Verify Success';
                        ctx.showToast(`✅ Đã cập nhật: ${label}`, 'success');
                    }
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to update wechat_status');
                }
            } catch (error) {
                console.error('Error updating wechat verify status:', error);
                if (typeof showToast === 'function') {
                    ctx.showToast(`Lỗi cập nhật: ${error.message}`, 'error');
                }
            }
        }
        // Notice modal functions
        function openNoticeModal(event) {
            return window.MXHAccountNotices.openNoticeModal(event);
        }

        function submitNotice() {
            return window.MXHAccountNotices.submitNotice();
        }

        function clearNotice(event) {
            return window.MXHAccountNotices.clearNotice(event);
        }

        function cancelNotice(accountId) {
            return window.MXHAccountNotices.cancelNotice(accountId);
        }

        function resetScanCountNew(accountId) {
            return window.MXHAccountNotices.resetScanCountNew(accountId);
        }
        // Open modal for editing account (WeChat or Generic)
        function openAccountModalForEdit(accountId) {
            ctx.currentContextAccountId = accountId;
            const account = ctx.mxhAccounts.find(acc => acc.id === accountId);

            if (!account) return;

            // Nếu là WeChat → mở WeChat modal, không thì mở generic modal
            if (account.platform === 'wechat') {
                openWeChatModal(accountId);
            } else {
                // Open generic modal for other platforms
                document.getElementById('generic-username').value = account.login_username || '';
                document.getElementById('generic-password').value = account.login_password || '';
                document.getElementById('generic-display-name').value = account.username || '';
                document.getElementById('generic-phone').value = account.phone || '';
                document.getElementById('generic-url').value = account.url || '';
                document.getElementById('generic-notes').value = account.notes || '';

                const modal = new bootstrap.Modal(document.getElementById('generic-account-modal'));
                modal.show();
            }
        }
        async function deleteAccount(accountId) {
            // Instant local update - remove from array
            const accountIndex = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
            if (accountIndex !== -1) {
                ctx.mxhAccounts.splice(accountIndex, 1);
            }
            ctx.scheduleRender();

            try {
                const response = await ctx.MXHApi.deleteAccount(accountId);

                if (response.ok) {
                    ctx.showToast('✅ Đã xóa card!', 'success');

                } else {
                    ctx.showToast('Lỗi!', 'error');
                    await ctx.loadMXHData(false);
                }
            } catch (error) {
                ctx.showToast('Lỗi kết nối!', 'error');
                await ctx.loadMXHData(false);
            }
        }
        async function resetAccount(accountId) {
            // Find the account and its card_id
            const accountIndex = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
            if (accountIndex === -1) {
                console.error(`Account ${accountId} not found for reset`);
                return;
            }

            const cardId = ctx.mxhAccounts[accountIndex].card_id;

            // Instant local update - reset all data
            const account = ctx.mxhAccounts[accountIndex];
            ctx.mxhAccounts[accountIndex] = {
                ...account, // Keep all existing fields
                id: account.id,
                card_id: account.card_id,
                platform: account.platform,
                group_id: account.group_id,
                card_name: account.card_name,
                is_primary: account.is_primary,
                // Reset these fields
                username: '.',
                phone: '.',
                wechat_nickname: '.',
                status: 'active',
                wechat_scan_count: 0,
                wechat_last_scan_date: null,
                die_date: null,
                disabled_date: null,
                rescue_count: 0,
                rescue_success_count: 0,
                notice: null,
                muted_until: null
            };

            // *** CRITICAL: Ensure activeAccountId is set BEFORE rendering ***
            // Force full rebuild to ensure UI updates
            ctx.requestFullRebuild();

            ctx.scheduleRender();

            try {
                const response = await ctx.MXHApi.resetAccount(accountId);

                if (response.ok) {
                    const updatedAccount = await response.json();
                    // Merge server response back into local data
                    const idx = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
                    if (idx !== -1) {
                        ctx.mxhAccounts[idx] = updatedAccount;
                        // Force full rebuild again to sync with server data
                        ctx.requestFullRebuild();
                        console.log(`✅ Reset account ${accountId}, keeping it as active for card ${cardId}`);
                        ctx.scheduleRender(); // Re-render with server data
                    }
                    ctx.showToast('✅ Đã reset card!', 'success');
                } else {
                    ctx.showToast('Lỗi!', 'error');
                    await ctx.loadMXHData(false);
                }
            } catch (error) {
                console.error('Error resetting account:', error);
                ctx.showToast('Lỗi kết nối!', 'error');
                await ctx.loadMXHData(false);
            }
        }
        // Modal Button Handlers with instant updates
        document.getElementById('mxh-save-account-btn').addEventListener('click', async () => {
            const platform = document.getElementById('mxh-platform').value;
            const username = (document.getElementById('mxh-username').value || '.').trim() || '.';
            const password = (document.getElementById('mxh-password')?.value || '.').trim() || '.';
            const phone = (document.getElementById('mxh-phone').value || '.').trim() || '.';
            const url = (document.getElementById('mxh-url').value || '.').trim() || '.';
            const day = parseInt(document.getElementById('mxh-day').value, 10);
            const month = parseInt(document.getElementById('mxh-month').value, 10);
            const year = parseInt(document.getElementById('mxh-year').value, 10);

            // Chỉ bắt buộc: NỀN TẢNG + NGÀY/THÁNG/NĂM (đã auto-fill)
            if (!platform || !day || !month || !year) {
                ctx.showToast('Chọn Nền tảng và Ngày tạo!', 'error');
                return;
            }

            try {
                const groupId = await ensurePlatformGroup(platform);
                const autoCardNumber = (await getNextCardNumber(groupId)).toString();

                const res = await ctx.MXHApi.createAccount({
                    card_name: autoCardNumber,
                    group_id: groupId,
                    platform,
                    username,             // nếu trống đã là "."
                    phone,
                    url,
                    login_username: ".",  // lưu cặp thông tin đăng nhập để hiện sau này
                    login_password: password,
                    wechat_created_day: day,
                    wechat_created_month: month,
                    wechat_created_year: year
                });

                if (res.ok) {
                    ctx.showToast('✅ Đã tạo card!', 'success');
                    bootstrap.Modal.getInstance(document.getElementById('mxh-addAccountModal')).hide();
                    await ctx.loadMXHData(false);
                } else {
                    const err = await res.json();
                    ctx.showToast(err.error || 'Lỗi khi tạo tài khoản!', 'error');
                }
            } catch {
                ctx.showToast('Lỗi kết nối!', 'error');
            }
        });
        document.getElementById('wechat-apply-btn').addEventListener('click', async () => {
            if (!ctx.currentContextAccountId) return;

            const selectedStatus = document.getElementById('wechat-status').value;

            // Get date value from single input and parse it
            const dateValue = document.getElementById('wechat-date').value;
            const dateParts = dateValue.split('/');
            const day = parseInt(dateParts[0]) || 1;
            const month = parseInt(dateParts[1]) || 1;
            const year = parseInt(dateParts[2]) || 2024;

            const data = {
                card_name: document.getElementById('wechat-card-name').value,
                username: document.getElementById('wechat-username').value,
                phone: document.getElementById('wechat-phone').value,
                wechat_nickname: document.getElementById('wechat-nickname').value,
                email: document.getElementById('wechat-email').value,
                notes: document.getElementById('wechat-notes').value,
                wechat_created_day: day,
                wechat_created_month: month,
                wechat_created_year: year,
                status: selectedStatus,  // Status chỉ còn 'active' hoặc 'disabled'
                wechat_status: selectedStatus
            };

            console.log('🔍 WeChat Apply - Data to save:', data);

            // Find account and preserve card_id
            const accountIndex = ctx.mxhAccounts.findIndex(acc => acc.id === ctx.currentContextAccountId);
            if (accountIndex === -1) {
                ctx.showToast('Lỗi: Không tìm thấy account!', 'error');
                return;
            }

            const cardId = Number(ctx.mxhAccounts[accountIndex].card_id);

            // Update local data immediately - preserve ALL existing properties
            Object.assign(ctx.mxhAccounts[accountIndex], data);

            // *** CRITICAL: Ensure activeAccountId is set BEFORE rendering ***
            ctx.setCardState(cardId, { activeAccountId: ctx.currentContextAccountId });
            console.log(`🔧 WeChat Apply: Updated account ${ctx.currentContextAccountId}, set as active for card ${cardId}`);
            console.log(`   Account exists in ctx.mxhAccounts:`, !!ctx.mxhAccounts.find(a => a.id === ctx.currentContextAccountId));
            console.log(`   Card accounts:`, ctx.mxhAccounts.filter(a => a.card_id === cardId).map(a => ({ id: a.id, is_primary: a.is_primary })));

            // Hide modal and re-render (preserves active account)
            bootstrap.Modal.getInstance(document.getElementById('wechat-account-modal')).hide();
            ctx.scheduleRender();

            try {
                console.log('🔍 Sending PUT request to:', `/mxh/api/accounts/${ctx.currentContextAccountId}`);
                const response = await ctx.MXHApi.updateAccount(ctx.currentContextAccountId, data);

                console.log('🔍 Response status:', response.status);

                if (response.ok) {
                    const updatedAccount = await response.json();
                    console.log('🔍 Updated account from server:', updatedAccount);
                    console.log('🔍 Email from server:', updatedAccount.email);
                    console.log('🔍 Full JSON:', JSON.stringify(updatedAccount, null, 2));
                    // Merge the server response back into local data
                    const idx = ctx.mxhAccounts.findIndex(acc => acc.id === ctx.currentContextAccountId);
                    if (idx !== -1) {
                        ctx.mxhAccounts[idx] = updatedAccount;
                        // *** CRITICAL: Keep the account active after server update ***
                        ctx.setCardState(cardId, { activeAccountId: ctx.currentContextAccountId });
                        console.log(`✅ Updated WeChat account ${ctx.currentContextAccountId}, keeping it as active for card ${cardId}`);
                        ctx.scheduleRender(); // Re-render with server data
                    }
                    ctx.showToast('✅ Đã cập nhật!', 'success');
                } else {
                    const errorText = await response.text();
                    console.error('🔍 Error response:', errorText);
                    try {
                        const error = JSON.parse(errorText);
                        ctx.showToast(error.error || 'Lỗi!', 'error');
                    } catch {
                        ctx.showToast('Lỗi: ' + errorText, 'error');
                    }
                    await ctx.loadMXHData(false);
                }
            } catch (error) {
                console.error('🔍 Fetch error:', error);
                ctx.showToast('Lỗi kết nối: ' + error.message, 'error');
                await ctx.loadMXHData(false);
            }
        });
        document.getElementById('generic-account-edit-form').addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission (browser refresh)
            if (!ctx.currentContextAccountId) return;

            const data = {
                login_username: document.getElementById('generic-username').value,
                login_password: document.getElementById('generic-password').value,
                username: document.getElementById('generic-display-name').value,
                phone: document.getElementById('generic-phone').value,
                url: document.getElementById('generic-url').value,
                notes: document.getElementById('generic-notes').value
            };

            // Find account and preserve card_id
            const accountIndex = ctx.mxhAccounts.findIndex(acc => acc.id === ctx.currentContextAccountId);
            if (accountIndex === -1) {
                ctx.showToast('Lỗi: Không tìm thấy account!', 'error');
                return;
            }

            const cardId = Number(ctx.mxhAccounts[accountIndex].card_id);

            // Instant local update
            Object.keys(data).forEach(key => {
                if (data[key] !== undefined && data[key] !== null) {
                    ctx.mxhAccounts[accountIndex][key] = data[key];
                }
            });

            // *** CRITICAL: Ensure activeAccountId is set BEFORE rendering ***
            ctx.setCardState(cardId, { activeAccountId: ctx.currentContextAccountId });
            console.log(`🔧 Generic Apply: Updated account ${ctx.currentContextAccountId}, set as active for card ${cardId}`);
            console.log(`   Account exists in ctx.mxhAccounts:`, !!ctx.mxhAccounts.find(a => a.id === ctx.currentContextAccountId));
            console.log(`   Card accounts:`, ctx.mxhAccounts.filter(a => a.card_id === cardId).map(a => ({ id: a.id, is_primary: a.is_primary })));

            bootstrap.Modal.getInstance(document.getElementById('generic-account-modal')).hide();
            ctx.scheduleRender();

            try {
                const response = await ctx.MXHApi.updateAccount(ctx.currentContextAccountId, data);

                if (response.ok) {
                    const updatedAccount = await response.json();
                    // Merge the server response back into local data
                    const idx = ctx.mxhAccounts.findIndex(acc => acc.id === ctx.currentContextAccountId);
                    if (idx !== -1) {
                        ctx.mxhAccounts[idx] = updatedAccount;
                        // *** CRITICAL: Keep the account active after server update ***
                        ctx.setCardState(cardId, { activeAccountId: ctx.currentContextAccountId });
                        console.log(`✅ Updated generic account ${ctx.currentContextAccountId}, keeping it as active for card ${cardId}`);
                        ctx.scheduleRender(); // Re-render with server data
                    }
                    ctx.showToast('✅ Đã cập nhật!', 'success');
                } else {
                    ctx.showToast('Lỗi!', 'error');
                    await ctx.loadMXHData(false);
                }
            } catch (error) {
                ctx.showToast('Lỗi kết nối!', 'error');
                await ctx.loadMXHData(false);
            }
        });
        document.getElementById('apply-card-number-btn').addEventListener('click', async () => {
            if (!ctx.currentContextAccountId) return;

            const newNumber = document.getElementById('new-card-number').value;
            if (!newNumber) return;

            // Instant local update
            const accountIndex = ctx.mxhAccounts.findIndex(acc => acc.id === ctx.currentContextAccountId);
            if (accountIndex !== -1) {
                ctx.mxhAccounts[accountIndex].card_name = newNumber;
            }

            bootstrap.Modal.getInstance(document.getElementById('change-card-number-modal')).hide();
            ctx.scheduleRender();

            try {
                const response = await ctx.MXHApi.updateAccount(ctx.currentContextAccountId, { card_name: newNumber });

                if (response.ok) {
                    const updatedAccount = await response.json();
                    // Update all accounts with the same card_id to have the new card_name
                    const cardId = updatedAccount.card_id;
                    ctx.mxhAccounts.forEach((acc, idx) => {
                        if (acc.card_id === cardId) {
                            ctx.mxhAccounts[idx].card_name = newNumber;
                        }
                    });
                    ctx.scheduleRender();
                    ctx.showToast('✅ Đã đổi số hiệu!', 'success');
                } else {
                    ctx.showToast('Lỗi!', 'error');
                    await ctx.loadMXHData(false);
                }
            } catch (error) {
                ctx.showToast('Lỗi kết nối!', 'error');
                await ctx.loadMXHData(false);
            }
        });
        document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
            if (!ctx.currentContextAccountId) return;
            await deleteAccount(ctx.currentContextAccountId);
            bootstrap.Modal.getInstance(document.getElementById('delete-card-modal')).hide();
        });
        // Reset button handlers
        document.getElementById('wechat-reset-btn').addEventListener('click', () => {
            if (!ctx.currentContextAccountId) return;
            const modal = new bootstrap.Modal(document.getElementById('reset-card-modal'));
            modal.show();
        });

        document.getElementById('generic-reset-btn').addEventListener('click', () => {
            if (!ctx.currentContextAccountId) return;
            const modal = new bootstrap.Modal(document.getElementById('reset-card-modal'));
            modal.show();
        });

        document.getElementById('confirm-reset-btn').addEventListener('click', async () => {
            if (!ctx.currentContextAccountId) return;
            await resetAccount(ctx.currentContextAccountId);

            // Safely hide modals - check if instance exists first
            const resetModal = bootstrap.Modal.getInstance(document.getElementById('reset-card-modal'));
            if (resetModal) resetModal.hide();

            const wechatModal = bootstrap.Modal.getInstance(document.getElementById('wechat-account-modal'));
            if (wechatModal) wechatModal.hide();

            const genericModal = bootstrap.Modal.getInstance(document.getElementById('generic-account-modal'));
            if (genericModal) genericModal.hide();
        });
        document.getElementById('mxh-apply-view-mode-btn').addEventListener('click', () => {
            const cardsPerRow = document.getElementById('mxh-cards-per-row').value;
            localStorage.setItem('mxh_cards_per_row', cardsPerRow);

            const style = document.getElementById('mxh-dynamic-style') || document.createElement('style');
            style.id = 'mxh-dynamic-style';
            style.innerHTML = `
        #mxh-accounts-container .row > .col {
            flex: 0 0 calc(100% / ${cardsPerRow});
            max-width: calc(100% / ${cardsPerRow});
        }
    `;
            if (!document.getElementById('mxh-dynamic-style')) {
                document.head.appendChild(style);
            }

            ctx.showToast(`Đã áp dụng ${cardsPerRow} cards/hàng!`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('mxh-view-mode-modal')).hide();
        });
        
        function openWeChatModal (accountId) {
            if (_openWeChatModalLock) return;
            _openWeChatModalLock = true;

            const account = ctx.mxhAccounts.find(acc => acc.id === accountId);
            if (!account) {
                console.error('🔍 Account not found:', accountId);
                _openWeChatModalLock = false;
                return;
            }

            console.log('🔍 Opening WeChat modal for account:', account);
            console.log('🔍 Date info:', {
                day: account.wechat_created_day,
                month: account.wechat_created_month,
                year: account.wechat_created_year
            });

            ctx.currentContextAccountId = accountId;

            const modalTitle = document.querySelector('#wechat-account-modal .modal-title');
            modalTitle.innerHTML = '<i class="bi bi-wechat me-2"></i>Thông Tin Tài Khoản';

            document.getElementById('wechat-card-name').value = account.card_name || '';
            document.getElementById('wechat-username').value = account.username || '';
            document.getElementById('wechat-phone').value = account.phone || '';
            document.getElementById('wechat-nickname').value = (account.wechat_nickname && account.wechat_nickname !== '.') ? account.wechat_nickname : '';
            document.getElementById('wechat-email').value = account.email || '';

            // 🔍 Format date for display - use current date if not set
            let day = account.wechat_created_day;
            let month = account.wechat_created_month;
            let year = account.wechat_created_year;

            // If date is not set, use current date
            if (!day || !month || !year) {
                const today = new Date();
                day = day || today.getDate();
                month = month || (today.getMonth() + 1);
                year = year || today.getFullYear();
                console.log('🔍 Date not set, using current date:', { day, month, year });
            }

            document.getElementById('wechat-date').value = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;

            const primaryStatus = account.status || 'active';
            document.getElementById('wechat-status').value = primaryStatus;

            // Load Ghi chú
            document.getElementById('wechat-notes').value = account.notes || '';

            // Load Lịch sử SĐT
            window.loadPhoneHistory(accountId);

            const modal = new bootstrap.Modal(document.getElementById('wechat-account-modal'));
            modal.show();

            setTimeout(() => { _openWeChatModalLock = false; }, 300);
        };
        // Toggle account status (click on status to change) - INSTANT UPDATE NO RELOAD
        async function toggleAccountStatus (event, accountId) {
            event.stopPropagation();
            event.preventDefault();

            // Find the account and update locally FIRST (instant UI update)
            const accountIndex = ctx.mxhAccounts.findIndex(acc => acc.id === accountId);
            if (accountIndex === -1) return;

            const currentStatus = ctx.mxhAccounts[accountIndex].status;

            // Toggle status locally
            const newStatus = currentStatus === 'disabled' ? 'active' : 'disabled';
            ctx.mxhAccounts[accountIndex].status = newStatus;

            // 🔍 Update disabled_date when toggling disabled status
            if (newStatus === 'disabled') {
                ctx.mxhAccounts[accountIndex].disabled_date = new Date().toISOString();
                ctx.mxhAccounts[accountIndex].die_date = null;
            } else {
                ctx.mxhAccounts[accountIndex].disabled_date = null;
                ctx.mxhAccounts[accountIndex].die_date = null;
            }

            // Re-render immediately (no API call wait)
            ctx.scheduleRender();

            // Then update backend in background
            try {
                const response = await ctx.MXHApi.toggleStatus(accountId);

                if (response.ok) {
                    ctx.showToast('✅ Đã thay đổi trạng thái!', 'success');
                } else {
                    // Revert on error
                    const error = await response.json();
                    ctx.showToast(error.error || 'Lỗi khi thay đổi trạng thái!', 'error');
                    await ctx.loadMXHData(false); // Reload to get correct data
                }
            } catch (error) {
                ctx.showToast('Lỗi kết nối!', 'error');
                await ctx.loadMXHData(false); // Reload to get correct data
            }
        };

    // ==========================================
    // EXPORTS
    // ==========================================
    window.MXHAccountActions = {
        init,
        ensurePlatformGroup,
        getNextCardNumber,
        openMoveAccountModal,
        createSubAccount,
        deleteCard,
        deleteSubAccount,
        rescueAccountAction,
        scanWeChatAccount,
        updateAccountStatusNew,
        updateWechatVerifyStatus,
        openNoticeModal,
        submitNotice,
        clearNotice,
        cancelNotice,
        resetScanCountNew,
        openAccountModalForEdit,
        deleteAccount,
        resetAccount,
        openWeChatModal,
        toggleAccountStatus
    };
})();
