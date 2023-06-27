-- disable adyen payment provider
UPDATE payment_provider
   SET mesomb_app_key = NULL,
       mesomb_access_key = NULL,
       mesomb_secret_key = NULL;
