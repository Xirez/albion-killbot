import { faStripe } from "@fortawesome/free-brands-svg-icons";
import {
  faCircleCheck,
  faCircleQuestion,
  faPeopleGroup,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import banner1 from "assets/subscription_banner_1.png";
import banner2 from "assets/subscription_banner_2.png";
import banner3 from "assets/subscription_banner_3.png";
import banner4 from "assets/subscription_banner_4.png";
import { Alert, Button, Card, Col, ListGroup, Row } from "react-bootstrap";
import { Link, useSearchParams } from "react-router-dom";
import Loader from "shared/components/Loader";
import { isSubscriptionActiveAndUnassiged } from "shared/subscriptions";
import { getCurrency } from "shared/utils";
import {
  SubscriptionPrice,
  useBuySubscriptionMutation,
  useFetchPricesQuery,
  useFetchSubscriptionsQuery,
} from "store/api";

const banners = [banner1, banner2, banner3, banner4];

const Premium = () => {
  const subscriptions = useFetchSubscriptionsQuery();
  const prices = useFetchPricesQuery();
  const [dispatchBuySubscription, buySubscription] =
    useBuySubscriptionMutation();
  const [queryParams] = useSearchParams();
  const status = queryParams.get("status");
  const checkoutId = queryParams.get("checkout_id");

  if (subscriptions.isFetching || buySubscription.isLoading) return <Loader />;
  if (buySubscription.isSuccess && buySubscription.data) {
    window.location.href = buySubscription.data.url;
  }

  const renderPrices = () => {
    if (prices.isFetching) return <Loader />;

    return (
      <Row className="gy-2">
        {prices.data?.map((price: SubscriptionPrice, i) => (
          <Col key={price.id} sm={6} lg={4} xxl={3} className="gx-4">
            <Card>
              <Card.Img variant="top" src={banners[i % banners.length]} />
              <Card.Body>
                <div className="d-flex justify-content-end align-items-baseline">
                  <h4>
                    {getCurrency(price.price / 100, {
                      currency: price.currency,
                    })}
                  </h4>
                  <div>/</div>
                  <div>
                    {price.recurrence.count} {price.recurrence.interval}
                  </div>
                </div>
                <ListGroup>
                  <ListGroup.Item className="d-flex align-items-center">
                    <FontAwesomeIcon icon={faCircleCheck} className="s-1" />
                    <span className="ps-2">No ads</span>
                  </ListGroup.Item>
                  <ListGroup.Item className="d-flex align-items-center">
                    <FontAwesomeIcon icon={faPeopleGroup} className="s-1" />
                    <span className="ps-2">Guild track slot</span>
                  </ListGroup.Item>
                  <ListGroup.Item className="d-flex align-items-center">
                    <FontAwesomeIcon icon={faCircleQuestion} className="s-1" />
                    <span className="ps-2">Premium support</span>
                  </ListGroup.Item>
                </ListGroup>
              </Card.Body>
              <Card.Footer>
                <div className="d-flex justify-content-stretch">
                  <Button
                    variant="primary"
                    style={{ width: "100%" }}
                    className="d-flex align-items-center"
                    onClick={() => dispatchBuySubscription(price.id)}
                  >
                    <FontAwesomeIcon icon={faStripe} className="s-2" />
                    <div>Checkout</div>
                  </Button>
                </div>
              </Card.Footer>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <div className="py-2">
      <div className="d-flex justify-content-center">
        <h1 className="py-2">Premium</h1>
      </div>
      {subscriptions.data?.some(isSubscriptionActiveAndUnassiged) && (
        <Alert className="mb-4" variant="success">
          You currently have an active subscription that is not assigned to a
          server. Please go to the <Link to="/dashboard">Dashboard</Link> to
          assign it to a server.
        </Alert>
      )}
      {status === "cancel" && (
        <Alert className="mb-4" variant="danger">
          Purchase cancelled.
        </Alert>
      )}
      {status === "success" && checkoutId && (
        <Alert className="mb-4" variant="secondary">
          Validating your subscription...
        </Alert>
      )}
      {renderPrices()}
    </div>
  );
};

export default Premium;
