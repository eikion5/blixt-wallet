import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, TouchableOpacity } from "react-native";
import { Body, Card, Text, CardItem, H1, View, Button, Icon } from "native-base";
import { StackNavigationProp } from "@react-navigation/stack";

import { LnUrlStackParamList } from "./index";
import { useStoreState, useStoreActions } from "../../state/store";
import { getDomainFromURL } from "../../utils";
import Blurmodal from "../../components/BlurModal";
import { ILNUrlPayRequest, ILNUrlPayRequestMetadata } from "../../state/LNURL";
import { Alert } from "../../utils/alert";
import PaymentCardMulti from "./PayRequest/PaymentCardMulti";
import PaymentDone from "./PayRequest/PaymentDone";
import style from "./PayRequest/style";
import { PLATFORM } from "../../utils/constants";
import { RouteProp } from "@react-navigation/native";

import { useTranslation } from "react-i18next";
import { namespaces } from "../../i18n/i18n.constants";

import { IPayRequestProps } from "./PayRequest";

export default function LNURLPayRequestMulti({ navigation, route }: IPayRequestProps) {
  const t = useTranslation(namespaces.LNURL.payRequest).t;
  const callback = (route?.params?.callback) ?? (() => {});
  const [preimage, setPreimage] = useState<Uint8Array | undefined>();
  const multiLnUrlStr = useStoreState((store) => store.lnUrl.multiLnUrlStr);
  const multiLnUrlObject = useStoreState((store) => store.lnUrl.multiLnUrlObject);
  const clear = useStoreActions((store) => store.lnUrl.clear);
  const multiPayRequestResponse = useStoreState((store) => store.lnUrl.multiPayRequestResponse);
  const multiDomain = multiLnUrlStr?.map((lnurlStr) => getDomainFromURL(lnurlStr ?? ""));

  useEffect(() => clear, []);

  try {
    if (multiDomain?.indexOf("") !== -1 || !multiLnUrlObject || multiLnUrlObject.find((lnUrlObject) => lnUrlObject.tag !== "payRequest")) {
      return (<></>);
    }

    const paidCallback = (preimage: Uint8Array) => {
      setPreimage(preimage);
    };

    const KeyboardAvoid = PLATFORM === "ios" ? KeyboardAvoidingView : View;

    return (
      <Blurmodal useModalComponent={false} goBackByClickingOutside={false}>
        <KeyboardAvoid behavior={"padding"} keyboardVerticalOffset={60}>
          <View style={style.keyboardContainer}>
            <Card style={style.card}>
              <CardItem style={style.cardItem}>
                <Body style={{ flex: 1, height: "100%" }}>
                  <View style={style.headerContainer}>
                    <H1 style={style.header}>
                      {!preimage ? "Pay" : "Paid"}
                    </H1>
                    <Text>Multiple destinations</Text>
                  </View>
                  {!preimage && <PaymentCardMulti onPaid={paidCallback} multiLnUrlObject={multiLnUrlObject as ILNUrlPayRequest[]} callback={callback} />}
                  {preimage && <PaymentDone preimage={preimage} callback={callback} />}
                </Body>
              </CardItem>
            </Card>
          </View>
        </KeyboardAvoid>
      </Blurmodal>
    );
  } catch (error) {
    Alert.alert(`${t("unableToPay")}:\n\n${error.message}`);
    callback(null);
    navigation.goBack();
    return (<></>);
  }
}
