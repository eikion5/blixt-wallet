import React, { useState } from "react";
import { Vibration, Keyboard, Image } from "react-native";
import { Text, View, Button } from "native-base";
import Long from "long";
import { useNavigation } from "@react-navigation/core";

import { useStoreState, useStoreActions } from "../../../state/store";
import { toast, getDomainFromURL, hexToUint8Array } from "../../../utils";
import { ILNUrlPayRequest, ILNUrlPayRequestMetadata, ILNUrlPayRequestPayerData, ILNUrlPayResponsePayerData } from "../../../state/LNURL";
import ScaledImage from "../../../components/ScaledImage";
import { formatBitcoin, convertBitcoinToFiat } from "../../../utils/bitcoin-units";
import ButtonSpinner from "../../../components/ButtonSpinner";
import style from "./style";
import useLightningReadyToSend from "../../../hooks/useLightingReadyToSend";
import { identifyService, lightningServices } from "../../../utils/lightning-services";
import { Alert } from "../../../utils/alert";
import { setupDescription } from "../../../utils/NameDesc";
import useBalance from "../../../hooks/useBalance";
import { IPayerDataProps, PayerData } from "./PayerData";
import { PLATFORM } from "../../../utils/constants";
import Input from "../../../components/Input";

import { useTranslation } from "react-i18next";
import { namespaces } from "../../../i18n/i18n.constants";

export interface IPaymentCardMultiProps {
  onPaid: (preimage: Uint8Array) => void;
  multiLnUrlObject: ILNUrlPayRequest[];
  callback?: (r: Uint8Array | null) => void;
}

export default function PaymentCardMulti({ onPaid, multiLnUrlObject, callback }: IPaymentCardMultiProps) {
  const t = useTranslation(namespaces.LNURL.payRequest).t;
  const navigation = useNavigation();
  const lightningReadyToSend = useLightningReadyToSend();

  const [doRequestLoading, setDoRequestLoading] = useState(false);

  const doPayRequest = useStoreActions((store) => store.lnUrl.doPayRequest);
  const multiLnUrlStr = useStoreState((store) => store.lnUrl.multiLnUrlStr);

  const currentRate = useStoreState((store) => store.fiat.currentRate);
  const sendPayment = useStoreActions((actions) => actions.send.sendPayment);
  const getBalance = useStoreActions((actions) => actions.channel.getBalance);
  const [comment, setComment] = useState<string | undefined>();
  const minSpendable = Math.max(...multiLnUrlObject.map((lnUrlObject) => lnUrlObject.minSendable));
  const maxSpendable = Math.min(...multiLnUrlObject.map((lnUrlObject) => lnUrlObject.maxSendable));
  const commentAllowed = multiLnUrlObject.filter((lnUrlObject) => lnUrlObject.commentAllowed).length === multiLnUrlObject.length;
  const domains = multiLnUrlStr?.map((lnurlStr) => getDomainFromURL(lnurlStr ?? ""));
  const name = useStoreState((store) => store.settings.name);
  const [sendName, setSendName] = useState<boolean | undefined>(commentAllowed !== undefined ? false : undefined);
  const preferFiat = useStoreState((store) => store.settings.preferFiat);
  const changePreferFiat = useStoreActions((store) => store.settings.changePreferFiat);
  const {
    dollarValue,
    bitcoinValue,
    satoshiValue,
    onChangeFiatInput,
    onChangeBitcoinInput,
    bitcoinUnit,
    fiatUnit,
  } = useBalance();
  const [sendButtonWidth, setSendButtonWidth] = useState<number | undefined>();

  try {
    const cancel = () => {
      callback?.(null);
      navigation.pop();
    };

    const paySingle = async (lnUrlObject: ILNUrlPayRequest): Promise<Uint8Array> => {
      const metadata = JSON.parse(lnUrlObject.metadata) as ILNUrlPayRequestMetadata;
      const payerDataConfig = lnUrlObject.payerData;
      const payerDataName = payerDataConfig?.name ?? null;

      const lightningAddress = metadata?.find((item) => item[0]?.toLowerCase?.() === "text/identifier" || item[0]?.toLowerCase?.() === "text/email");

      const text = metadata.find((m, i) => {
        return m[0]?.toLowerCase?.() === "text/plain";
      })?.[1];

      let c = comment;
      if (!payerDataName && c && c.length > 0 && sendName && name) {
        c = setupDescription(c, name);
      }

      let sendPayerData = false;
      const payerData: ILNUrlPayResponsePayerData = {};
      if (payerDataName) {
        if (payerDataName.mandatory) {
          sendPayerData = true;
          payerData.name = name ?? "Anonymous";
        } else if (sendName) {
          sendPayerData = true;
          payerData.name = name ?? "";
        }
      }

      const amountMsat = minSpendable !== maxSpendable
        ? satoshiValue * 1000
        : minSpendable;

      const paymentRequestResponse = await doPayRequest({
        msat: amountMsat,
        comment: c,
        lightningAddress: lightningAddress?.[1] ?? null,
        lud16IdentifierMimeType: lightningAddress?.[0] ?? null,
        metadataTextPlain: text ?? "Invoice description missing",
        payerData: sendPayerData ? payerData : undefined,
      });
      const response = await sendPayment();
      return hexToUint8Array(response.paymentPreimage);
    };
  
    const onPressPay = async () => {
      setDoRequestLoading(true);

      try {
        const preimages = await Promise.all(multiLnUrlObject.map(async (lnUrlObject) => {
          return await paySingle(lnUrlObject);
        }));

        const preimage = preimages[0];
        Vibration.vibrate(32);
        onPaid(preimage);
      } catch (e) {
        Vibration.vibrate(50);
        toast(
          "Error: " + e.message,
          12000,
          "danger",
          "Okay"
        );
      } finally {
        setDoRequestLoading(false);
      }
    }

    const onPressCurrencyButton = async () => {
      await changePreferFiat(!preferFiat);
    }

    const minSpendableFormatted = formatBitcoin(Long.fromValue(minSpendable ?? 0).div(1000), bitcoinUnit.key);
    const minSpendableFiatFormatted = convertBitcoinToFiat(Long.fromValue(minSpendable ?? 0).div(1000), currentRate) + " " + fiatUnit;

    const maxSpendableFormatted = formatBitcoin(Long.fromValue(maxSpendable ?? 0).div(1000), bitcoinUnit.key);
    const maxSpendableFiatFormatted = convertBitcoinToFiat(Long.fromValue(maxSpendable ?? 0).div(1000), currentRate) + " " + fiatUnit;

    return (
      <>
        {/* <View style={style.contentContainer}> */}
          <View style={{ flexDirection: "row" }}>
            <Text style={style.text}>
              <Text style={style.boldText}>{t("form.multipleRecipients")}</Text> {t("form.asksYouToPay")}
            </Text>
          </View>
          <Text style={style.text}>
            <Text style={style.boldText}>{t("form.description.title")}:</Text>{"\n"}
            {t("form.description.textMultiple", { count: multiLnUrlObject.length })}
          </Text>
          <Text style={style.inputLabel}>
            <Text style={style.boldText}>{t("form.amount.title")}:</Text>{"\n"}
            {minSpendableFormatted} ({minSpendableFiatFormatted})
            {(minSpendable !== maxSpendable) &&
              <Text>{" "}{t("form.amount.to")} {maxSpendableFormatted} ({maxSpendableFiatFormatted})</Text>
            }
          </Text>
          {minSpendable !== maxSpendable &&
            <View style={style.inputAmountContainer}>
              <Input
                onChangeText={preferFiat ?  onChangeFiatInput : onChangeBitcoinInput}
                keyboardType="numeric"
                returnKeyType="done"
                placeholder={`${t("form.amount.placeholder")} (${preferFiat ? fiatUnit : bitcoinUnit.nice})`}
                style={[style.input, { marginRight: PLATFORM === "macos" ? 90 : undefined }]}
                value={preferFiat ? dollarValue : bitcoinValue}
              />
              <Button
                small
                style={style.inputCurrencyButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={onPressCurrencyButton}
              >
                <Text style={{fontSize: 10 }}>
                  {preferFiat && <>{fiatUnit}</>}
                  {!preferFiat && <>{bitcoinUnit.nice}</>}
                </Text>
              </Button>
            </View>
          }
          {/* {(payerData || typeof commentAllowed === "number" && commentAllowed > 0) &&
            <PayerData
              commentAllowed={commentAllowed}
              domain={domain}
              name={name}
              payerDataName={payerDataName}
              sendName={sendName}
              setComment={setComment}
              setSendName={setSendName}
            />
          } */}
        {/* </View> */}
        <View style={[style.actionBar, { flexGrow: 1 }]}>
          <Button
            success
            disabled={!lightningReadyToSend || doRequestLoading || (minSpendable !== maxSpendable ? satoshiValue <= 0 : false)}
            onPress={onPressPay}
            style={{
              marginLeft: 10,
              width: sendButtonWidth,
              justifyContent: "center",
            }}
            onLayout={(event) => {
              if (!sendButtonWidth && lightningReadyToSend) {
                setSendButtonWidth(event.nativeEvent.layout.width);
              }
            }}
            small={true}
          >
            {(!doRequestLoading && lightningReadyToSend) ? <Text>{t("pay.title")}</Text> : <ButtonSpinner />}
          </Button>
          <Button
            onPress={cancel}
            style={{
              marginRight: 10,
            }}
            danger
            small={true}
          >
            <Text>{t("cancel.title")}</Text>
          </Button>
        </View>
      </>
    );
  } catch (error) {
    Alert.alert(`${t("form.alert")}:\n\n${error.message}`);
    callback?.(null);
    navigation.goBack();
    return (<></>)
  }
}
